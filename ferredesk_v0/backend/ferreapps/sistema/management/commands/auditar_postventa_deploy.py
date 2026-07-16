import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import Count, Q, Sum
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.caja.models import Cheque, MovimientoCaja, PagoVenta
from ferreapps.caja.services.control_fondos import _calcular_caja_actual
from ferreapps.cuenta_corriente.models import Imputacion, OrdenPago, Recibo
from ferreapps.productos.models import Stock, StockProve
from ferreapps.ventas.models import Venta, VentaDetalleItem
from tenants.models import EmpresaTenant


MODELOS_HISTORICOS = {
    "ventas": Venta,
    "items_venta": VentaDetalleItem,
    "imputaciones": Imputacion,
    "recibos": Recibo,
    "ordenes_pago": OrdenPago,
    "pagos_venta": PagoVenta,
    "movimientos_caja": MovimientoCaja,
    "cheques": Cheque,
    "stock": Stock,
    "stock_proveedor": StockProve,
}


def _monto(valor):
    return format(valor or Decimal("0.00"), ".2f")


def _pagos_ambiguos():
    ambiguos = []
    pagos = PagoVenta.objects.values(
        "id", "es_vuelto", "venta_id", "recibo_id", "orden_pago_id"
    ).order_by("id")
    for pago in pagos.iterator():
        origenes = sum(
            origen is not None
            for origen in (pago["venta_id"], pago["recibo_id"], pago["orden_pago_id"])
        )
        if origenes != 1:
            ambiguos.append(pago["id"])
    return ambiguos


def _saldo_bancos_historico():
    pagos = PagoVenta.objects.filter(cuenta_banco__isnull=False).filter(
        Q(venta__isnull=False, venta__ven_estado__in=["CO", "CE"])
        | Q(recibo__isnull=False, recibo__rec_estado=Recibo.ESTADO_ACTIVO)
        | Q(orden_pago__isnull=False, orden_pago__op_estado=OrdenPago.ESTADO_ACTIVO)
    )
    ingresos = pagos.filter(es_vuelto=False, orden_pago__isnull=True).aggregate(
        total=Sum("monto")
    )["total"]
    egresos = pagos.filter(Q(es_vuelto=True) | Q(orden_pago__isnull=False)).aggregate(
        total=Sum("monto")
    )["total"]
    cheques = Cheque.objects.filter(
        estado=Cheque.ESTADO_ACREDITADO,
        cuenta_banco_deposito__isnull=False,
    ).aggregate(total=Sum("monto"))["total"]
    return (ingresos or Decimal("0.00")) - (egresos or Decimal("0.00")) + (
        cheques or Decimal("0.00")
    )


def _saldos_control():
    caja, _ = _calcular_caja_actual()
    return {
        "caja": _monto(caja),
        "bancos": _monto(_saldo_bancos_historico()),
        "cheques_en_cartera": _monto(
            Cheque.objects.filter(estado=Cheque.ESTADO_EN_CARTERA).aggregate(
                total=Sum("monto")
            )["total"]
        ),
        "cheques_depositados": _monto(
            Cheque.objects.filter(estado=Cheque.ESTADO_DEPOSITADO).aggregate(
                total=Sum("monto")
            )["total"]
        ),
    }


def _resumen_tenant(schema_name):
    with schema_context(schema_name):
        pagos = PagoVenta.objects
        resumen = {
            "conteos": {nombre: modelo.objects.count() for nombre, modelo in MODELOS_HISTORICOS.items()},
            "saldos_control": _saldos_control(),
            "pagos": {
                "cantidad": pagos.count(),
                "monto": _monto(pagos.aggregate(total=Sum("monto"))["total"]),
                "ambiguos": _pagos_ambiguos(),
            },
        }
        with connection.cursor() as cursor:
            columnas = {
                descripcion.name.casefold()
                for descripcion in connection.introspection.get_table_description(
                    cursor, PagoVenta._meta.db_table
                )
            }
        if PagoVenta._meta.get_field("tipo_operacion").column.casefold() in columnas:
            resumen["pagos"]["por_tipo"] = {
                tipo: {"cantidad": cantidad, "monto": _monto(monto)}
                for tipo, cantidad, monto in pagos.values_list("tipo_operacion")
                .order_by("tipo_operacion")
                .annotate(cantidad=Count("id"), monto=Sum("monto"))
            }
        return resumen


def construir_snapshot():
    with schema_context(get_public_schema_name()):
        schemas = list(
            EmpresaTenant.objects.exclude(schema_name=get_public_schema_name())
            .order_by("schema_name")
            .values_list("schema_name", flat=True)
        )
    return {
        "version": 1,
        "tenants": {schema: _resumen_tenant(schema) for schema in schemas},
    }


def diferencias_snapshot(anterior, actual):
    diferencias = []
    anteriores = anterior.get("tenants", {})
    actuales = actual.get("tenants", {})
    if set(anteriores) != set(actuales):
        diferencias.append("Los schemas tenant no coinciden.")
        return diferencias

    for schema, previo in anteriores.items():
        nuevo = actuales[schema]
        for campo, valor in previo["conteos"].items():
            if nuevo["conteos"].get(campo) != valor:
                diferencias.append(f"{schema}: conteo {campo} cambio de {valor} a {nuevo['conteos'].get(campo)}")
        for campo, valor in previo.get("saldos_control", {}).items():
            if nuevo.get("saldos_control", {}).get(campo) != valor:
                diferencias.append(f"{schema}: saldo {campo} cambio durante la migracion")
        for campo in ("cantidad", "monto", "ambiguos"):
            if nuevo["pagos"].get(campo) != previo["pagos"].get(campo):
                diferencias.append(f"{schema}: pagos.{campo} cambio durante la migracion")
        por_tipo = nuevo["pagos"].get("por_tipo")
        if por_tipo is None:
            diferencias.append(f"{schema}: falta la clasificacion tipo_operacion")
        elif sum(item["cantidad"] for item in por_tipo.values()) != nuevo["pagos"]["cantidad"]:
            diferencias.append(f"{schema}: la clasificacion tipo_operacion no cubre todos los pagos")
        if nuevo["pagos"]["ambiguos"]:
            diferencias.append(f"{schema}: existen pagos ambiguos")
    return diferencias


class Command(BaseCommand):
    help = "Genera y compara evidencia previa y posterior al deploy de postventa."

    def add_arguments(self, parser):
        parser.add_argument("--output", help="Archivo JSON donde guardar el snapshot.")
        parser.add_argument("--compare", help="Snapshot previo contra el cual comparar.")

    def handle(self, *args, **options):
        snapshot = construir_snapshot()
        if options["compare"]:
            try:
                anterior = json.loads(Path(options["compare"]).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise CommandError(f"No se pudo leer el snapshot previo: {exc}") from exc
            diferencias = diferencias_snapshot(anterior, snapshot)
            if diferencias:
                raise CommandError("\n".join(diferencias))

        contenido = json.dumps(snapshot, indent=2, sort_keys=True)
        if options["output"]:
            Path(options["output"]).write_text(contenido + "\n", encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Snapshot guardado en {options['output']}"))
        else:
            self.stdout.write(contenido)
