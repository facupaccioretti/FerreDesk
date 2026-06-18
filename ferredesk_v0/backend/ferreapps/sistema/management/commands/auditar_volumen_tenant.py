from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.caja.models import PagoVenta
from ferreapps.clientes.models import Cliente
from ferreapps.compras.models import Compra, CompraDetalleItem
from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.productos.models import PrecioProveedorExcel, Stock, StockProve
from ferreapps.ventas.models import Venta, VentaDetalleItem
from tenants.models import EmpresaTenant


class Command(BaseCommand):
    help = "Audita cantidad de filas de tablas clave para un tenant/schema."

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            dest="schema_name",
            help="Schema tenant a auditar. Si se omite, usa el schema activo de la conexion.",
        )

    def handle(self, *args, **options):
        schema_name = options.get("schema_name") or getattr(
            connection, "schema_name", get_public_schema_name()
        )

        if schema_name == get_public_schema_name():
            raise CommandError(
                "Debes indicar un schema tenant con --schema o ejecutar el comando dentro de un tenant activo."
            )

        with schema_context(get_public_schema_name()):
            tenant = EmpresaTenant.objects.filter(schema_name=schema_name).first()

        if tenant is None:
            raise CommandError(f"No existe un tenant con schema '{schema_name}'.")

        self.stdout.write(
            self.style.SUCCESS(
                f"Auditoria de volumen tenant schema={schema_name} dominio={tenant.slug_subdominio}"
            )
        )

        modelos = [
            ("Stock", Stock),
            ("StockProve", StockProve),
            ("PrecioProveedorExcel", PrecioProveedorExcel),
            ("Venta", Venta),
            ("VentaDetalleItem", VentaDetalleItem),
            ("Compra", Compra),
            ("CompraDetalleItem", CompraDetalleItem),
            ("Cliente", Cliente),
            ("Imputacion", Imputacion),
            ("PagoVenta", PagoVenta),
        ]

        with schema_context(schema_name):
            for etiqueta, modelo in modelos:
                self.stdout.write(f"{etiqueta}: {modelo.objects.count()}")
