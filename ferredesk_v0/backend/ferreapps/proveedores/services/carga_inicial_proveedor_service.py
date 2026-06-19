import hashlib
import json
import random
import re
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from ferreapps.productos.models import AlicuotaIVA, ProductoTempID, Stock, StockProve
from ferreapps.proveedores.models import (
    HistorialImportacionProveedor,
    SolicitudCargaInicialProveedor,
)
from ferredesk_backend.utils.observability import medir_proceso


def normalizar_codigo_proveedor(texto):
    if texto is None:
        return ""
    if isinstance(texto, int):
        s = str(texto)
    elif isinstance(texto, float):
        s = str(int(texto)) if float(texto).is_integer() else str(texto)
    elif isinstance(texto, Decimal):
        s = str(int(texto)) if texto == texto.to_integral_value() else str(texto)
    else:
        s = str(texto)
    s = s.strip()
    if re.fullmatch(r"\d+\.0+", s):
        s = s.split(".", 1)[0]
    s = re.sub(r"\s+", " ", s)
    return s[:100]


def normalizar_denominacion(texto):
    if texto is None:
        return ""
    max_deno = getattr(settings, "PRODUCTO_DENOMINACION_MAX_CARACTERES", 50)
    return str(texto).strip()[:max_deno]


def derivar_sigla(proveedor):
    if proveedor.sigla:
        return proveedor.sigla.strip()
    base = (proveedor.fantasia or proveedor.razon or "").upper()
    letras = re.findall(r"[A-Z]", base)
    return "".join(letras[:3]) or "PRV"


def generar_codvta(proveedor, codigo_proveedor, estrategia):
    base_sigla = derivar_sigla(proveedor)
    if estrategia in ("sigla+aleatorio", "sigla+random"):
        candidato = f"{base_sigla}{random.randint(1000, 99999)}"
    elif estrategia in ("sigla+codigo", "sigla+cod"):
        candidato = f"{base_sigla}{codigo_proveedor}"
    else:
        candidato = codigo_proveedor
    candidato = re.sub(r"\s+", "-", candidato)
    candidato = re.sub(r"-+", "-", candidato)
    if len(candidato) > 15:
        candidato = candidato[:15]
    return candidato or f"{base_sigla}0001"


def calcular_idempotency_key(*, proveedor, nombre_archivo, parametros_lote, filas_validas):
    payload = {
        "proveedor_id": proveedor.id,
        "nombre_archivo": nombre_archivo or "carga_inicial",
        "parametros_lote": parametros_lote or {},
        "filas_validas": filas_validas or [],
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def crear_solicitud_carga_inicial_pendiente(
    *,
    proveedor,
    usuario,
    nombre_archivo,
    parametros_lote,
    filas_validas,
    totales_preview=None,
):
    nombre_archivo = nombre_archivo or "carga_inicial"
    parametros_lote = parametros_lote or {}
    filas_validas = filas_validas or []
    idempotency_key = calcular_idempotency_key(
        proveedor=proveedor,
        nombre_archivo=nombre_archivo,
        parametros_lote=parametros_lote,
        filas_validas=filas_validas,
    )

    with medir_proceso(
        "crear_solicitud_carga_inicial_proveedor",
        proveedor_id=proveedor.id,
        usuario_id=getattr(usuario, "id", None),
        cantidad_filas=len(filas_validas),
    ):
        existente = (
            SolicitudCargaInicialProveedor.objects.filter(
                proveedor=proveedor,
                idempotency_key=idempotency_key,
                estado__in=[
                    SolicitudCargaInicialProveedor.ESTADO_PENDIENTE,
                    SolicitudCargaInicialProveedor.ESTADO_PROCESANDO,
                ],
            )
            .order_by("-creado_en")
            .first()
        )
        if existente:
            return existente, False

        solicitud = SolicitudCargaInicialProveedor.objects.create(
            proveedor=proveedor,
            usuario=usuario if getattr(usuario, "is_authenticated", False) else None,
            nombre_archivo=nombre_archivo,
            idempotency_key=idempotency_key,
        )

        payload_dict = {
            "parametros_lote": parametros_lote,
            "filas_validas": filas_validas,
            "totales_preview": totales_preview or {},
        }
        payload_bytes = json.dumps(payload_dict, ensure_ascii=False).encode("utf-8")
        solicitud.archivo_temporal.save(f"{idempotency_key}.json", ContentFile(payload_bytes))

        return solicitud, True


def _resolver_codvta_disponible(base, codvta_ocupados):
    codvta = base[:15] if len(base) > 15 else base
    if codvta and codvta not in codvta_ocupados:
        return codvta

    for sufijo in ("-1", "-2", "-3"):
        prefijo = codvta[: 15 - len(sufijo)]
        candidato = f"{prefijo}{sufijo}"
        if candidato not in codvta_ocupados:
            return candidato

    for _ in range(10):
        sufijo = str(random.randint(100, 999))
        candidato = f"{codvta[: 15 - len(sufijo)]}{sufijo}"
        if candidato not in codvta_ocupados:
            return candidato

    return ""


def _preparar_filas_para_creacion(proveedor, parametros_lote, filas):
    idaliiva_id = parametros_lote.get("idaliiva_id")
    margen = parametros_lote.get("margen")
    unidad = parametros_lote.get("unidad")
    cantmin = parametros_lote.get("cantmin")
    codvta_estrategia = (
        parametros_lote.get("codvta_estrategia") or "sigla+codigo"
    ).strip().lower()

    if not idaliiva_id:
        raise ValueError("Falta idaliiva_id.")
    alicuota = AlicuotaIVA.objects.get(pk=idaliiva_id)

    try:
        margen_decimal = Decimal(str(margen))
    except Exception as exc:
        raise ValueError("Margen invalido.") from exc

    cantmin_int = None
    if cantmin is not None and str(cantmin).strip() != "":
        try:
            cantmin_int = int(cantmin)
        except Exception:
            cantmin_int = None

    normalizadas = []
    codigos_proveedor = []
    codvta_candidatos = []

    for fila in filas:
        codigo_proveedor = normalizar_codigo_proveedor(fila.get("codigo_proveedor"))
        denominacion = normalizar_denominacion(fila.get("denominacion"))
        costo_raw = fila.get("costo")
        codvta_propuesto = (
            fila.get("codvta") or fila.get("codvta_propuesto") or ""
        ).strip()

        try:
            costo = Decimal(str(costo_raw))
            if costo < 0:
                raise ValueError()
            costo = costo.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            costo = None

        codvta_base = codvta_propuesto or generar_codvta(
            proveedor, codigo_proveedor, codvta_estrategia
        )
        normalizadas.append(
            {
                "codigo_proveedor": codigo_proveedor,
                "denominacion": denominacion,
                "costo": costo,
                "codvta_base": codvta_base,
            }
        )
        if codigo_proveedor:
            codigos_proveedor.append(codigo_proveedor)
        if codvta_base:
            codvta_candidatos.append(codvta_base[:15])

    codvta_ocupados = set(
        Stock.objects.filter(codvta__in=codvta_candidatos).values_list(
            "codvta", flat=True
        )
    )
    codigos_ocupados = set(
        StockProve.objects.filter(
            proveedor=proveedor,
            codigo_producto_proveedor__in=codigos_proveedor,
        ).values_list("codigo_producto_proveedor", flat=True)
    )
    codigos_lote = set()

    filas_creables = []
    saltados = 0

    for fila in normalizadas:
        codigo_proveedor = fila["codigo_proveedor"]
        if not codigo_proveedor:
            saltados += 1
            continue
        if fila["costo"] is None:
            saltados += 1
            continue
        if not fila["denominacion"]:
            saltados += 1
            continue
        if codigo_proveedor in codigos_ocupados or codigo_proveedor in codigos_lote:
            saltados += 1
            continue

        codvta = _resolver_codvta_disponible(fila["codvta_base"], codvta_ocupados)
        if not codvta:
            saltados += 1
            continue

        codigos_lote.add(codigo_proveedor)
        codvta_ocupados.add(codvta)
        filas_creables.append(
            {
                **fila,
                "codvta": codvta,
                "margen": margen_decimal,
                "alicuota": alicuota,
                "unidad": unidad,
                "cantmin": cantmin_int,
            }
        )

    return filas_creables, saltados


def _reservar_ids_producto(cantidad):
    if cantidad <= 0:
        return []

    ultimo_id = (
        ProductoTempID.objects.select_for_update().aggregate(max_id=Max("id"))["max_id"]
        or -4
    )
    ids = [ultimo_id + (indice + 1) * 5 for indice in range(cantidad)]
    ProductoTempID.objects.bulk_create(
        [ProductoTempID(id=producto_id) for producto_id in ids],
        batch_size=500,
    )
    return ids


def procesar_carga_inicial_proveedor(*, proveedor, nombre_archivo, parametros_lote, filas):
    filas_creables, saltados = _preparar_filas_para_creacion(
        proveedor, parametros_lote, filas
    )

    with transaction.atomic():
        ids_producto = _reservar_ids_producto(len(filas_creables))
        stocks = []
        stock_proves = []

        for producto_id, fila in zip(ids_producto, filas_creables):
            stock = Stock(
                id=producto_id,
                codvta=fila["codvta"],
                deno=fila["denominacion"],
                margen=fila["margen"],
                idaliiva=fila["alicuota"],
                proveedor_habitual=proveedor,
                acti="S",
            )
            if fila["unidad"]:
                stock.unidad = fila["unidad"]
            if fila["cantmin"] is not None:
                stock.cantmin = fila["cantmin"]
            stocks.append(stock)
            stock_proves.append(
                StockProve(
                    stock_id=producto_id,
                    proveedor=proveedor,
                    cantidad=Decimal("0"),
                    costo=fila["costo"],
                    codigo_producto_proveedor=fila["codigo_proveedor"],
                )
            )

        if stocks:
            Stock.objects.bulk_create(stocks, batch_size=500)
            StockProve.objects.bulk_create(stock_proves, batch_size=500)

        HistorialImportacionProveedor.objects.create(
            proveedor=proveedor,
            nombre_archivo=nombre_archivo or "carga_inicial",
            registros_procesados=len(filas),
            registros_actualizados=len(stocks),
        )

    return {
        "procesados": len(filas),
        "creados": len(stocks),
        "saltados": saltados,
    }


def procesar_solicitud_carga_inicial(solicitud_id):
    with transaction.atomic():
        solicitud = (
            SolicitudCargaInicialProveedor.objects.select_for_update()
            .select_related("proveedor")
            .get(pk=solicitud_id)
        )

        if solicitud.estado != SolicitudCargaInicialProveedor.ESTADO_PENDIENTE:
            return solicitud

        solicitud.estado = SolicitudCargaInicialProveedor.ESTADO_PROCESANDO
        solicitud.iniciado_en = timezone.now()
        solicitud.finalizado_en = None
        solicitud.mensaje_error = ""
        solicitud.save(
            update_fields=[
                "estado",
                "iniciado_en",
                "finalizado_en",
                "mensaje_error",
                "actualizado_en",
            ]
        )

    try:
        payload = {}
        if solicitud.archivo_temporal:
            payload = json.loads(solicitud.archivo_temporal.read().decode("utf-8"))
        parametros_lote = payload.get("parametros_lote") or {}
        filas = payload.get("filas_validas") or []
        with medir_proceso(
            "procesar_carga_inicial_proveedor",
            proveedor_id=solicitud.proveedor_id,
            solicitud_id=solicitud.id,
            cantidad_filas=len(filas),
        ) as medicion:
            resultado = procesar_carga_inicial_proveedor(
                proveedor=solicitud.proveedor,
                nombre_archivo=solicitud.nombre_archivo,
                parametros_lote=parametros_lote,
                filas=filas,
            )
            medicion.registrar_metricas(
                filas_procesadas=resultado["procesados"],
                creados=resultado["creados"],
                saltados=resultado["saltados"],
            )

        solicitud.estado = SolicitudCargaInicialProveedor.ESTADO_COMPLETADA
        solicitud.registros_procesados = resultado["procesados"]
        solicitud.registros_creados = resultado["creados"]
        solicitud.registros_saltados = resultado["saltados"]
        solicitud.mensaje_error = ""

        # Eliminar el archivo temporal al completarse con éxito
        if solicitud.archivo_temporal:
            solicitud.archivo_temporal.delete(save=False)
    except Exception as exc:
        solicitud.estado = SolicitudCargaInicialProveedor.ESTADO_ERROR
        solicitud.mensaje_error = str(exc)
    finally:
        solicitud.finalizado_en = timezone.now()
        solicitud.save(
            update_fields=[
                "estado",
                "registros_procesados",
                "registros_creados",
                "registros_saltados",
                "mensaje_error",
                "finalizado_en",
                "actualizado_en",
                "archivo_temporal",
            ]
        )

    return solicitud
