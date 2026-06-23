from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db import connection
from django.db.models import DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from ferreapps.cuenta_corriente.models import OrdenPago, Recibo

from ..models import (
    Cheque,
    CuentaBanco,
    MovimientoCaja,
    PagoVenta,
    SesionCaja,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    ESTADO_CAJA_ABIERTA,
)


CONTROL_FONDOS_PRESETS = {7, 15, 30, 60, 90}
CONTROL_FONDOS_CACHE_TTL_SECONDS = 15
CONTROL_FONDOS_CACHE_VERSION_DEFAULT = 1
ZERO = Decimal("0.00")


def _decimal_or_zero(value):
    return value if value is not None else ZERO


def _money(value):
    return str(_decimal_or_zero(value).quantize(Decimal("0.01")))


def resolve_control_fondos_preset(preset):
    try:
        preset_int = int(preset)
    except (TypeError, ValueError):
        preset_int = 30
    if preset_int not in CONTROL_FONDOS_PRESETS:
        preset_int = 30
    return preset_int


def resolve_recent_activity_range(*, fecha_desde=None, fecha_hasta=None):
    tz = timezone.get_current_timezone()
    if fecha_hasta:
        fecha_hasta = timezone.datetime.strptime(fecha_hasta, "%Y-%m-%d")
        fecha_hasta = timezone.make_aware(
            fecha_hasta.replace(hour=23, minute=59, second=59, microsecond=999999),
            timezone=tz,
        )
    else:
        fecha_hasta = timezone.now()

    if fecha_desde:
        fecha_desde = timezone.datetime.strptime(fecha_desde, "%Y-%m-%d")
        fecha_desde = timezone.make_aware(
            fecha_desde.replace(hour=0, minute=0, second=0, microsecond=0),
            timezone=tz,
        )
    else:
        fecha_desde = fecha_hasta - timedelta(days=30)

    return fecha_desde, fecha_hasta


def _calcular_saldo_teorico_sesion(sesion):
    ingresos = _decimal_or_zero(
        sesion.movimientos.filter(tipo=TIPO_MOVIMIENTO_ENTRADA).aggregate(total=Sum("monto"))["total"]
    )
    egresos = _decimal_or_zero(
        sesion.movimientos.filter(tipo=TIPO_MOVIMIENTO_SALIDA).aggregate(total=Sum("monto"))["total"]
    )
    return sesion.saldo_inicial + ingresos - egresos


def _calcular_caja_actual():
    decimal_field = DecimalField(max_digits=15, decimal_places=2)
    ingresos_subquery = (
        MovimientoCaja.objects.filter(
            sesion_caja=OuterRef("pk"),
            tipo=TIPO_MOVIMIENTO_ENTRADA,
        )
        .values("sesion_caja")
        .annotate(total=Sum("monto"))
        .values("total")[:1]
    )
    egresos_subquery = (
        MovimientoCaja.objects.filter(
            sesion_caja=OuterRef("pk"),
            tipo=TIPO_MOVIMIENTO_SALIDA,
        )
        .values("sesion_caja")
        .annotate(total=Sum("monto"))
        .values("total")[:1]
    )

    sesiones = SesionCaja.objects.filter(estado=ESTADO_CAJA_ABIERTA).annotate(
        ingresos=Coalesce(
            Subquery(ingresos_subquery, output_field=decimal_field),
            Value(ZERO, output_field=decimal_field),
        ),
        egresos=Coalesce(
            Subquery(egresos_subquery, output_field=decimal_field),
            Value(ZERO, output_field=decimal_field),
        ),
    )
    total = _decimal_or_zero(
        sesiones.aggregate(
            total=Sum(
                F("saldo_inicial") + F("ingresos") - F("egresos"),
                output_field=decimal_field,
            )
        )["total"]
    )
    return total, sesiones.count()


def _pagos_bancarios_qs():
    return PagoVenta.objects.filter(
        cuenta_banco__isnull=False,
        es_vuelto=False,
    ).filter(
        Q(venta__isnull=False, venta__ven_estado="CO")
        | Q(recibo__isnull=False, recibo__rec_estado=Recibo.ESTADO_ACTIVO)
        | Q(orden_pago__isnull=False, orden_pago__op_estado=OrdenPago.ESTADO_ACTIVO)
    )


def _calcular_bancos_actual():
    pagos_bancarios = _pagos_bancarios_qs()
    ingresos = _decimal_or_zero(
        pagos_bancarios.filter(Q(venta__isnull=False) | Q(recibo__isnull=False)).aggregate(total=Sum("monto"))["total"]
    )
    egresos = _decimal_or_zero(
        pagos_bancarios.filter(orden_pago__isnull=False).aggregate(total=Sum("monto"))["total"]
    )
    cheques_acreditados = _decimal_or_zero(
        Cheque.objects.filter(
            estado=Cheque.ESTADO_ACREDITADO,
            cuenta_banco_deposito__isnull=False,
        ).aggregate(total=Sum("monto"))["total"]
    )
    return ingresos - egresos + cheques_acreditados


def _calcular_total_cheques(estado):
    qs = Cheque.objects.filter(estado=estado)
    total = _decimal_or_zero(qs.aggregate(total=Sum("monto"))["total"])
    cantidad = qs.count()
    return total, cantidad


def _control_fondos_schema_name():
    return getattr(connection, "schema_name", "default")


def _control_fondos_cache_version_key():
    return f"caja:control-fondos:{_control_fondos_schema_name()}:version"


def get_control_fondos_cache_version():
    version = cache.get(_control_fondos_cache_version_key())
    if version is None:
        return CONTROL_FONDOS_CACHE_VERSION_DEFAULT
    return int(version)


def invalidate_control_fondos_cache(*, reason=None):
    current_version = get_control_fondos_cache_version()
    next_version = current_version + 1
    cache.set(_control_fondos_cache_version_key(), next_version, None)
    return next_version


def _build_control_fondos_payload_uncached(*, preset=None, include_bloque_reciente=False):
    preset_resuelto = resolve_control_fondos_preset(preset)
    caja_total, cajas_abiertas = _calcular_caja_actual()
    bancos_total = _calcular_bancos_actual()
    cartera_total, cartera_cantidad = _calcular_total_cheques(Cheque.ESTADO_EN_CARTERA)
    pendiente_total, pendiente_cantidad = _calcular_total_cheques(Cheque.ESTADO_DEPOSITADO)

    disponible_hoy = caja_total + bancos_total
    total_administrado = disponible_hoy + cartera_total + pendiente_total

    payload = {
        "resumen_actual": {
            "fecha_corte": timezone.now().isoformat(),
            "moneda": "ARS",
            "kpis": {
                "disponible_hoy": {
                    "monto": _money(disponible_hoy),
                    "descripcion": "Liquidez inmediata registrada",
                },
                "caja": {
                    "monto": _money(caja_total),
                    "descripcion": "Efectivo vigente en sesiones abiertas",
                },
                "bancos": {
                    "monto": _money(bancos_total),
                    "descripcion": "Fondos registrados en cuentas y billeteras",
                },
                "cheques_en_cartera": {
                    "monto": _money(cartera_total),
                    "descripcion": "Valores fisicos aun no depositados",
                },
                "pendiente_acreditacion": {
                    "monto": _money(pendiente_total),
                    "descripcion": "Cheques depositados aun no acreditados",
                },
                "total_administrado": {
                    "monto": _money(total_administrado),
                    "descripcion": "Fondos y valores administrados por Tesoreria",
                },
            },
        },
        "composicion": {
            "disponible_hoy": {
                "componentes": [
                    {"codigo": "caja", "monto": _money(caja_total)},
                    {"codigo": "bancos", "monto": _money(bancos_total)},
                ],
                "total": _money(disponible_hoy),
            },
            "total_administrado": {
                "componentes": [
                    {"codigo": "caja", "monto": _money(caja_total)},
                    {"codigo": "bancos", "monto": _money(bancos_total)},
                    {"codigo": "cheques_en_cartera", "monto": _money(cartera_total)},
                    {"codigo": "pendiente_acreditacion", "monto": _money(pendiente_total)},
                ],
                "total": _money(total_administrado),
            },
            "fuentes": {
                "caja": "sesiones_caja_abiertas",
                "bancos": "pagos_con_cuenta_banco_y_cheques_acreditados",
                "cheques_en_cartera": "cheques_estado_en_cartera",
                "pendiente_acreditacion": "cheques_estado_depositado",
            },
        },
        "seniales": {
            "criterio_conservador": True,
            "usa_solo_datos_registrados": True,
            "incluye_saldos_externos": False,
            "hay_caja_abierta": cajas_abiertas > 0,
            "hay_cheques_pendientes": pendiente_cantidad > 0,
            "cantidad_cheques_en_cartera": cartera_cantidad,
            "cantidad_cheques_pendientes": pendiente_cantidad,
            "cantidad_cuentas_activas": CuentaBanco.objects.filter(activo=True).count(),
        },
        "drilldown": {
            "caja": {
                "tab": "caja_actual",
                "fallback_tab": "historial_cajas",
                "vista_inicial": "resumen",
                "requiere_contexto": "sesion_abierta",
            },
            "bancos": {
                "tab": "bancos",
                "vista_inicial": "listado",
                "filtro_inicial": None,
                "requiere_contexto": None,
            },
            "cheques_en_cartera": {
                "tab": "cheques",
                "vista_inicial": "operativo",
                "filtro_inicial": Cheque.ESTADO_EN_CARTERA,
                "requiere_contexto": None,
            },
            "pendiente_acreditacion": {
                "tab": "cheques",
                "vista_inicial": "historial",
                "filtro_inicial": Cheque.ESTADO_DEPOSITADO,
                "requiere_contexto": None,
            },
            "disponible_hoy": {
                "tab": "control_fondos",
                "vista_inicial": "composicion",
                "filtro_inicial": None,
                "requiere_contexto": None,
            },
            "total_administrado": {
                "tab": "control_fondos",
                "vista_inicial": "composicion",
                "filtro_inicial": None,
                "requiere_contexto": None,
            },
        },
    }

    if include_bloque_reciente:
        fecha_hasta = timezone.now()
        fecha_desde = fecha_hasta - timedelta(days=preset_resuelto)
        payload["bloque_reciente"] = {
            "preset_aplicado": preset_resuelto,
            "presets_permitidos": sorted(CONTROL_FONDOS_PRESETS),
            "rango": {
                "desde": fecha_desde.date().isoformat(),
                "hasta": fecha_hasta.date().isoformat(),
            },
            "metricas_operativas": build_recent_activity_metrics(
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta,
            ),
        }

    return payload


def _control_fondos_cache_key(*, preset=None, include_bloque_reciente=False):
    schema_name = _control_fondos_schema_name()
    preset_resuelto = resolve_control_fondos_preset(preset)
    cache_version = get_control_fondos_cache_version()
    return (
        f"caja:control-fondos:{schema_name}:"
        f"v:{cache_version}:preset:{preset_resuelto}:bloque:{int(bool(include_bloque_reciente))}"
    )


def build_control_fondos_payload(*, preset=None, include_bloque_reciente=False, use_cache=True):
    if not use_cache:
        return _build_control_fondos_payload_uncached(
            preset=preset,
            include_bloque_reciente=include_bloque_reciente,
        )

    cache_key = _control_fondos_cache_key(
        preset=preset,
        include_bloque_reciente=include_bloque_reciente,
    )
    cached_payload = cache.get(cache_key)
    if cached_payload is not None:
        return cached_payload

    payload = _build_control_fondos_payload_uncached(
        preset=preset,
        include_bloque_reciente=include_bloque_reciente,
    )
    cache.set(cache_key, payload, CONTROL_FONDOS_CACHE_TTL_SECONDS)
    return payload


def build_recent_activity_metrics(*, fecha_desde, fecha_hasta):
    pagos = (
        PagoVenta.objects.filter(
            fecha_hora__range=(fecha_desde, fecha_hasta),
            es_vuelto=False,
        )
        .filter(Q(venta__isnull=False) | Q(recibo__isnull=False))
        .exclude(venta__ven_estado="AN")
        .exclude(recibo__rec_estado=Recibo.ESTADO_ANULADO)
        .select_related(
            "metodo_pago",
            "cuenta_banco",
            "venta",
            "venta__ven_idcli",
            "venta__comprobante",
            "venta__sesion_caja",
            "recibo",
            "recibo__rec_cliente",
            "recibo__sesion_caja",
        )
        .order_by("-fecha_hora", "-id")
    )

    movimientos_entrada = (
        MovimientoCaja.objects.filter(
            tipo=TIPO_MOVIMIENTO_ENTRADA,
            fecha_hora__range=(fecha_desde, fecha_hasta),
        )
        .select_related("sesion_caja", "usuario")
        .order_by("-fecha_hora", "-id")
    )

    cheques_por_movimiento = {
        cheque.movimiento_caja_entrada_id: cheque
        for cheque in Cheque.objects.filter(
            movimiento_caja_entrada_id__in=movimientos_entrada.values_list("id", flat=True)
        ).select_related("origen_cliente")
    }

    items = []
    total_monto = ZERO
    total_caja = ZERO
    total_fuera_caja = ZERO

    for pago in pagos:
        if pago.recibo_id:
            tramite = pago.recibo
            canal = "CAJA" if pago.recibo.sesion_caja_id else "FUERA_CAJA"
            origen = "Recibo"
            referencia_principal = pago.recibo.rec_numero
            tercero = pago.recibo.rec_cliente.razon if pago.recibo.rec_cliente else "S/C"
        else:
            tramite = pago.venta
            canal = "CAJA" if pago.venta.sesion_caja_id else "FUERA_CAJA"
            origen = pago.venta.comprobante.nombre if pago.venta.comprobante else "Venta"
            referencia_principal = f"{pago.venta.ven_punto:04d}-{pago.venta.ven_numero:08d}"
            tercero = pago.venta.ven_idcli.razon if pago.venta.ven_idcli else "S/C"

        monto = pago.monto or ZERO
        total_monto += monto
        if canal == "CAJA":
            total_caja += monto
        else:
            total_fuera_caja += monto

        referencias = [referencia_principal, tercero]
        if pago.referencia_externa:
            referencias.append(f"Ref. ext.: {pago.referencia_externa}")
        if pago.cuenta_banco_id:
            referencias.append(f"Cuenta: {pago.cuenta_banco.nombre}")
        if getattr(tramite, "sesion_caja_id", None):
            referencias.append(f"Caja #{tramite.sesion_caja_id}")

        items.append(
            {
                "id": f"pago-{pago.id}",
                "fecha": pago.fecha_hora,
                "origen": origen,
                "medio_pago": pago.metodo_pago.nombre,
                "monto": monto,
                "canal": canal,
                "referencias": " | ".join(ref for ref in referencias if ref),
            }
        )

    for movimiento in movimientos_entrada:
        cheque = cheques_por_movimiento.get(movimiento.id)
        medio_pago = "Cheque" if cheque else "Efectivo"
        origen = "Ingreso manual de caja"
        referencias = [movimiento.descripcion]

        if cheque:
            origen = "Cheque por caja"
            referencias.append(f"Cheque {cheque.numero}")
            referencias.append(cheque.banco_emisor)
            if cheque.origen_cliente:
                referencias.append(cheque.origen_cliente.razon)

        monto = movimiento.monto or ZERO
        total_monto += monto
        total_caja += monto
        referencias.append(f"Caja #{movimiento.sesion_caja_id}")

        items.append(
            {
                "id": f"movimiento-{movimiento.id}",
                "fecha": movimiento.fecha_hora,
                "origen": origen,
                "medio_pago": medio_pago,
                "monto": monto,
                "canal": "CAJA",
                "referencias": " | ".join(ref for ref in referencias if ref),
            }
        )

    items.sort(key=lambda item: item["fecha"], reverse=True)

    return {
        "total_registros": len(items),
        "total_monto": _money(total_monto),
        "total_caja": _money(total_caja),
        "total_fuera_caja": _money(total_fuera_caja),
        "cantidad_caja": len([item for item in items if item["canal"] == "CAJA"]),
        "cantidad_fuera_caja": len([item for item in items if item["canal"] == "FUERA_CAJA"]),
        "rango": {
            "desde": fecha_desde.strftime("%Y-%m-%d"),
            "hasta": fecha_hasta.strftime("%Y-%m-%d"),
        },
    }
