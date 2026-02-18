"""
Management command: verificar_calculos_orm
Compara los cálculos del ORM (con_calculos) vs la vista SQL (VENTA_CALCULADO)
para validar paridad antes de eliminar las vistas SQL.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import connection

from ferreapps.ventas.models import Venta, VentaCalculada


class Command(BaseCommand):
    help = 'Compara cálculos ORM vs Vista SQL para verificar paridad'

    def add_arguments(self, parser):
        parser.add_argument('--cantidad', type=int, default=100, help='Cantidad de ventas a verificar (default 100)')
        parser.add_argument('--umbral', type=float, default=0.01, help='Umbral de diferencia en $ (default 0.01)')
        parser.add_argument('--solo-errores', action='store_true', help='Mostrar solo las diferencias')

    def handle(self, *args, **options):
        cantidad = options['cantidad']
        umbral = Decimal(str(options['umbral']))
        solo_errores = options['solo_errores']
        verbosity = options['verbosity']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n{"="*70}\n'
            f'  VERIFICACIÓN DE PARIDAD: ORM vs Vista SQL\n'
            f'  Ventas a verificar: {cantidad} | Umbral: ${umbral}\n'
            f'{"="*70}\n'
        ))

        # --- 1. Obtener datos del ORM ---
        orm_qs = Venta.objects.con_calculos().order_by('-ven_id')[:cantidad]
        orm_data = {}
        for v in orm_qs:
            orm_data[v.ven_id] = {
                'ven_total': Decimal(str(getattr(v, '_ven_total', None) or v.ven_total or 0)),
                'ven_impneto': Decimal(str(getattr(v, '_ven_impneto', None) or v.ven_impneto or 0)),
                'iva_global': Decimal(str(getattr(v, '_iva_global', None) or v.iva_global or 0)),
                'numero_formateado': getattr(v, '_numero_formateado', None) or v.numero_formateado or '',
            }

        if not orm_data:
            self.stdout.write(self.style.WARNING('No se encontraron ventas para verificar.'))
            return

        ids = list(orm_data.keys())

        # --- 2. Obtener datos de la Vista SQL ---
        sql_data = {}
        try:
            # Intentar leer directamente de la vista SQL
            placeholders = ','.join(['%s'] * len(ids))
            with connection.cursor() as cursor:
                cursor.execute(
                    f'SELECT ven_id, ven_total, ven_impneto, numero_formateado '
                    f'FROM "VENTA_CALCULADO" WHERE ven_id IN ({placeholders})',
                    ids
                )
                for row in cursor.fetchall():
                    sql_data[row[0]] = {
                        'ven_total': Decimal(str(row[1] or 0)),
                        'ven_impneto': Decimal(str(row[2] or 0)),
                        'numero_formateado': row[3] or '',
                    }
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'  ❌ No se pudo consultar la vista SQL VENTA_CALCULADO: {e}\n'
                f'  → La vista probablemente ya fue eliminada.\n'
                f'  → Solo se pueden verificar los cálculos ORM (sin comparación).\n'
            ))
            # Mostrar resumen solo ORM
            self._mostrar_resumen_orm(orm_data, verbosity)
            return

        # --- 3. Comparar ---
        ok = 0
        errores = 0
        campos_diff = {'ven_total': 0, 'ven_impneto': 0, 'numero_formateado': 0}

        for ven_id in sorted(ids, reverse=True):
            orm = orm_data.get(ven_id)
            sql = sql_data.get(ven_id)

            if not sql:
                if not solo_errores:
                    self.stdout.write(f'  ⚠️  VEN_ID={ven_id}: No existe en vista SQL (nueva?)')
                continue

            diffs = []

            # Comparar ven_total
            diff_total = abs(orm['ven_total'] - sql['ven_total'])
            if diff_total > umbral:
                diffs.append(f"ven_total: ORM=${orm['ven_total']} vs SQL=${sql['ven_total']} (Δ={diff_total})")
                campos_diff['ven_total'] += 1

            # Comparar ven_impneto
            diff_neto = abs(orm['ven_impneto'] - sql['ven_impneto'])
            if diff_neto > umbral:
                diffs.append(f"ven_impneto: ORM=${orm['ven_impneto']} vs SQL=${sql['ven_impneto']} (Δ={diff_neto})")
                campos_diff['ven_impneto'] += 1

            # Comparar numero_formateado (string exacto, ignorando espacios)
            orm_num = orm['numero_formateado'].strip()
            sql_num = sql['numero_formateado'].strip()
            if orm_num != sql_num:
                diffs.append(f"numero: ORM='{orm_num}' vs SQL='{sql_num}'")
                campos_diff['numero_formateado'] += 1

            if diffs:
                errores += 1
                self.stdout.write(self.style.ERROR(f'  ❌ VEN_ID={ven_id}:'))
                for d in diffs:
                    self.stdout.write(f'     → {d}')
            else:
                ok += 1
                if not solo_errores and verbosity >= 2:
                    self.stdout.write(self.style.SUCCESS(f'  ✅ VEN_ID={ven_id}: OK (total=${orm["ven_total"]})'))

        # --- 4. Resumen ---
        total_verificadas = ok + errores
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n{"="*70}'))
        self.stdout.write(f'  RESUMEN: {total_verificadas} ventas verificadas')
        self.stdout.write(self.style.SUCCESS(f'  ✅ Coincidentes: {ok}'))
        if errores:
            self.stdout.write(self.style.ERROR(f'  ❌ Con diferencias: {errores}'))
            for campo, cnt in campos_diff.items():
                if cnt:
                    self.stdout.write(self.style.WARNING(f'     → {campo}: {cnt} diferencias'))
            self.stdout.write(self.style.ERROR('\n  ⚠️  HAY DIFERENCIAS. Investigar antes de eliminar las vistas SQL.\n'))
        else:
            self.stdout.write(self.style.SUCCESS('\n  ✅ PARIDAD TOTAL. Es seguro eliminar las vistas SQL.\n'))

    def _mostrar_resumen_orm(self, orm_data, verbosity):
        """Muestra solo las primeras N ventas del ORM cuando no hay vista SQL."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n  Primeras ventas calculadas por ORM:'))
        for ven_id in sorted(orm_data.keys(), reverse=True)[:10]:
            d = orm_data[ven_id]
            self.stdout.write(
                f"  VEN_ID={ven_id}: total=${d['ven_total']} neto=${d['ven_impneto']} "
                f"num='{d['numero_formateado']}'"
            )
        self.stdout.write(f'\n  Total ventas procesadas por ORM: {len(orm_data)}\n')
