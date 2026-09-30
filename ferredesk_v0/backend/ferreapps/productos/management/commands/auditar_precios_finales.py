import csv
from decimal import Decimal
from io import StringIO

from django.core.management.base import BaseCommand, CommandError
from django.db.models import OuterRef, Subquery
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.productos.models import Stock, StockProve
from tenants.models import EmpresaTenant


CENTAVO = Decimal('0.01')


def _money(value):
    if value is None:
        return ''
    return str(Decimal(str(value)).quantize(CENTAVO))


def _clasificar(precio, formula_anterior, formula_final, tolerancia):
    if precio is None:
        return 'sin_precio'
    if formula_anterior is None or formula_final is None:
        return 'sin_costo_habitual'

    coincide_anterior = abs(precio - formula_anterior) <= tolerancia
    coincide_final = abs(precio - formula_final) <= tolerancia
    if coincide_anterior and coincide_final:
        return 'coincide_ambas'
    if coincide_anterior:
        return 'candidato_formula_sin_iva'
    if coincide_final:
        return 'coincide_formula_final'
    return 'requiere_revision'


class Command(BaseCommand):
    help = 'Emite un CSV de solo lectura para auditar la semantica historica de Lista 0.'

    def add_arguments(self, parser):
        parser.add_argument('--schema', required=True, dest='schema_name')
        parser.add_argument('--tolerancia', default='0.01')

    def handle(self, *args, **options):
        schema_name = options['schema_name']
        tolerancia = Decimal(options['tolerancia'])
        if tolerancia < 0:
            raise CommandError('La tolerancia no puede ser negativa.')

        with schema_context(get_public_schema_name()):
            tenant = EmpresaTenant.objects.filter(schema_name=schema_name).first()
        if tenant is None or schema_name == get_public_schema_name():
            raise CommandError(f"No existe un tenant con schema '{schema_name}'.")

        costo_habitual = StockProve.objects.filter(
            stock_id=OuterRef('pk'),
            proveedor_id=OuterRef('proveedor_habitual_id'),
        ).order_by('-id').values('costo')[:1]

        buffer = StringIO()
        writer = csv.writer(buffer, lineterminator='')
        writer.writerow([
            'tenant',
            'stock_id',
            'codvta',
            'precio_lista_0',
            'precio_manual',
            'costo_habitual',
            'margen',
            'iva',
            'formula_anterior',
            'formula_final',
            'clasificacion',
        ])
        self.stdout.write(buffer.getvalue())

        with schema_context(schema_name):
            productos = Stock.objects.select_related('idaliiva').annotate(
                costo_habitual=Subquery(costo_habitual),
            ).order_by('id')

            for producto in productos.iterator():
                precio = producto.precio_lista_0
                costo = producto.costo_habitual
                margen = Decimal(str(producto.margen or 0))
                iva = Decimal(str(producto.idaliiva.porce or 0))
                formula_anterior = None
                formula_final = None
                if costo is not None:
                    costo = Decimal(str(costo))
                    formula_anterior = (
                        costo * (1 + margen / Decimal('100'))
                    ).quantize(CENTAVO)
                    formula_final = (
                        costo
                        * (1 + margen / Decimal('100'))
                        * (1 + iva / Decimal('100'))
                    ).quantize(CENTAVO)

                buffer = StringIO()
                writer = csv.writer(buffer, lineterminator='')
                writer.writerow([
                    schema_name,
                    producto.id,
                    producto.codvta,
                    _money(precio),
                    producto.precio_lista_0_manual,
                    _money(costo),
                    _money(margen),
                    _money(iva),
                    _money(formula_anterior),
                    _money(formula_final),
                    _clasificar(precio, formula_anterior, formula_final, tolerancia),
                ])
                self.stdout.write(buffer.getvalue())
