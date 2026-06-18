import os
import re
from decimal import Decimal

import pyexcel as pe
from django.core.files.base import File
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ferreapps.productos.models import (
    ImportacionListaPreciosProveedor,
    PrecioProveedorExcel,
    StockProve,
)
from ferreapps.proveedores.models import HistorialImportacionProveedor
from ferredesk_backend.utils.observability import medir_proceso


class LimiteImportacionSincronicaExcedido(Exception):
    def __init__(self, detail, *, limite_tipo, maximo_permitido, valor_detectado):
        super().__init__(detail)
        self.detail = detail
        self.error_code = "importacion_sync_limite_excedido"
        self.limite_tipo = limite_tipo
        self.maximo_permitido = maximo_permitido
        self.valor_detectado = valor_detectado


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


def importar_lista_precios_proveedor(
    *,
    proveedor,
    excel_file,
    col_codigo="A",
    col_precio="B",
    col_denominacion="C",
    fila_inicio=2,
    validar_limites_sync=True,
):
    filename = excel_file.name
    with medir_proceso(
        "importacion_lista_precios_proveedor",
        proveedor_id=proveedor.id,
        archivo=filename,
        archivo_bytes=getattr(excel_file, "size", None),
        fila_inicio=fila_inicio,
    ) as medicion:
        ext = os.path.splitext(filename)[1].lower().replace(".", "")
        sheet = pe.get_sheet(file_type=ext, file_content=excel_file.read())

        to_create = []
        col_codigo_idx = ord(col_codigo.upper()) - 65
        col_precio_idx = ord(col_precio.upper()) - 65
        col_denominacion_idx = ord(col_denominacion.upper()) - 65
        max_len_denominacion = (
            PrecioProveedorExcel._meta.get_field("denominacion").max_length or 200
        )
        max_filas_sync = (
            getattr(settings, "IMPORTACION_LISTA_MAX_FILAS_SYNC", 0)
            if validar_limites_sync
            else 0
        )
        filas_evaluadas = 0

        for i, row in enumerate(sheet.rows()):
            if i + 1 < fila_inicio:
                continue
            filas_evaluadas += 1
            if max_filas_sync and filas_evaluadas > max_filas_sync:
                raise LimiteImportacionSincronicaExcedido(
                    (
                        f"La importación supera el límite síncrono permitido de {max_filas_sync} filas. "
                        "Reduzca el archivo o espere el flujo diferido."
                    ),
                    limite_tipo="filas",
                    maximo_permitido=max_filas_sync,
                    valor_detectado=filas_evaluadas,
                )
            try:
                codigo = row[col_codigo_idx]
                precio = row[col_precio_idx]
                denominacion = row[col_denominacion_idx] if col_denominacion_idx < len(row) else None
            except IndexError:
                continue

            if codigo is None or precio is None:
                continue

            try:
                precio_decimal = Decimal(str(precio).replace(",", ".").replace("$", "").strip())
                denominacion_str = str(denominacion).strip() if denominacion is not None else ""
                if denominacion_str and max_len_denominacion:
                    denominacion_str = denominacion_str[:max_len_denominacion]
                codigo_norm = normalizar_codigo_proveedor(codigo)
                to_create.append(
                    PrecioProveedorExcel(
                        proveedor=proveedor,
                        codigo_producto_excel=codigo_norm,
                        precio=precio_decimal,
                        denominacion=denominacion_str,
                        nombre_archivo=filename,
                    )
                )
            except Exception:
                continue

        unique_map = {}
        for obj in to_create:
            key = (obj.proveedor_id, obj.codigo_producto_excel)
            unique_map[key] = obj
        to_create = list(unique_map.values())

        now = timezone.now()
        registros_actualizados = 0

        with transaction.atomic():
            PrecioProveedorExcel.objects.filter(proveedor=proveedor).delete()
            PrecioProveedorExcel.objects.bulk_create(to_create, batch_size=500)

            precio_por_codigo = {
                obj.codigo_producto_excel: obj.precio
                for obj in to_create
                if obj.codigo_producto_excel
            }
            codigos = list(precio_por_codigo.keys())

            if codigos:
                stock_proves = list(
                    StockProve.objects.filter(
                        proveedor=proveedor,
                        codigo_producto_proveedor__in=codigos,
                    )
                )

                for stock_prove in stock_proves:
                    codigo = normalizar_codigo_proveedor(stock_prove.codigo_producto_proveedor)
                    nuevo_costo = precio_por_codigo.get(codigo)
                    if nuevo_costo is None:
                        continue
                    stock_prove.costo = nuevo_costo
                    stock_prove.fecha_actualizacion = now

                if stock_proves:
                    StockProve.objects.bulk_update(
                        stock_proves,
                        ["costo", "fecha_actualizacion"],
                        batch_size=500,
                    )
                    registros_actualizados = len(stock_proves)

            HistorialImportacionProveedor.objects.create(
                proveedor=proveedor,
                nombre_archivo=filename,
                registros_procesados=len(to_create),
                registros_actualizados=registros_actualizados,
            )

        medicion.registrar_metricas(
            filas_procesadas=len(to_create),
            registros_actualizados=registros_actualizados,
        )

        return {
            "precios_cargados": len(to_create),
            "registros_actualizados": registros_actualizados,
        }


def crear_importacion_pendiente_lista_precios(
    *,
    proveedor,
    usuario,
    excel_file,
    col_codigo="A",
    col_precio="B",
    col_denominacion="C",
    fila_inicio=2,
):
    if hasattr(excel_file, "seek"):
        excel_file.seek(0)

    importacion = ImportacionListaPreciosProveedor(
        proveedor=proveedor,
        usuario=usuario,
        nombre_archivo=os.path.basename(getattr(excel_file, "name", "archivo")),
        col_codigo=col_codigo.upper(),
        col_precio=col_precio.upper(),
        col_denominacion=col_denominacion.upper(),
        fila_inicio=fila_inicio,
    )
    importacion.archivo_temporal.save(
        importacion.nombre_archivo,
        File(excel_file),
        save=False,
    )
    importacion.save()
    return importacion


def procesar_importacion_pendiente_lista_precios(importacion_id):
    with transaction.atomic():
        importacion = (
            ImportacionListaPreciosProveedor.objects.select_for_update()
            .get(pk=importacion_id)
        )

        if importacion.estado != ImportacionListaPreciosProveedor.ESTADO_PENDIENTE:
            return importacion

        importacion.estado = ImportacionListaPreciosProveedor.ESTADO_PROCESANDO
        importacion.iniciado_en = timezone.now()
        importacion.finalizado_en = None
        importacion.mensaje_error = ""
        importacion.save(
            update_fields=[
                "estado",
                "iniciado_en",
                "finalizado_en",
                "mensaje_error",
                "actualizado_en",
            ]
        )

    try:
        importacion.archivo_temporal.open("rb")
        if hasattr(importacion.archivo_temporal, "seek"):
            importacion.archivo_temporal.seek(0)

        resultado = importar_lista_precios_proveedor(
            proveedor=importacion.proveedor,
            excel_file=importacion.archivo_temporal,
            col_codigo=importacion.col_codigo,
            col_precio=importacion.col_precio,
            col_denominacion=importacion.col_denominacion,
            fila_inicio=importacion.fila_inicio,
            validar_limites_sync=False,
        )
        importacion.estado = ImportacionListaPreciosProveedor.ESTADO_COMPLETADA
        importacion.registros_procesados = resultado["precios_cargados"]
        importacion.registros_actualizados = resultado["registros_actualizados"]
        importacion.mensaje_error = ""
    except Exception as exc:
        importacion.estado = ImportacionListaPreciosProveedor.ESTADO_ERROR
        importacion.mensaje_error = str(exc)
    finally:
        importacion.finalizado_en = timezone.now()
        importacion.save(
            update_fields=[
                "estado",
                "registros_procesados",
                "registros_actualizados",
                "mensaje_error",
                "finalizado_en",
                "actualizado_en",
            ]
        )
        if importacion.archivo_temporal:
            importacion.archivo_temporal.close()

    return importacion
