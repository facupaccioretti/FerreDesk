"""
Management command: verificar_items_orm
Compara TODOS los campos calculados a nivel de ITEM entre el ORM (con_calculos)
y la vista SQL (VENTADETALLEITEM_CALCULADO), campo por campo.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import connection

from ferreapps.ventas.models import VentaDetalleItem


# Campos a comparar: (nombre_sql, nombre_orm, umbral, es_decimal)
CAMPOS_COMPARAR = [
    ('ali_porce',                       'ali_porce',                        Decimal('0.01'), True),
    ('vdi_precio_unitario_final',       'vdi_precio_unitario_final',        Decimal('0.01'), True),
    ('precio_unitario_sin_iva',         'precio_unitario_sin_iva',          Decimal('0.0001'), True),
    ('iva_unitario',                    'iva_unitario',                     Decimal('0.0001'), True),
    ('bonif_monto_unit_neto',           'bonif_monto_unit_neto',            Decimal('0.0001'), True),
    ('precio_unit_bonif_sin_iva',       'precio_unit_bonif_sin_iva',        Decimal('0.0001'), True),
    ('precio_unitario_bonif_desc_sin_iva', 'precio_unitario_bonif_desc_sin_iva', Decimal('0.0001'), True),
    ('precio_unitario_bonificado_con_iva', 'precio_unitario_bonificado_con_iva', Decimal('0.01'), True),
    ('precio_unitario_bonificado',      'precio_unitario_bonificado',       Decimal('0.01'), True),
    ('subtotal_neto',                   'subtotal_neto',                    Decimal('0.01'), True),
    ('iva_monto',                       'iva_monto',                        Decimal('0.01'), True),
    ('total_item',                      'total_item',                       Decimal('0.01'), True),
    ('margen_monto',                    'margen_monto',                     Decimal('0.001'), True),
    ('margen_porcentaje',               'margen_porcentaje',                Decimal('0.001'), True),
]

# Campos extra a nivel de venta (VENTA_CALCULADO vs con_calculos)
CAMPOS_VENTA = [
    ('ven_total',   '_ven_total',    Decimal('0.01')),
    ('ven_impneto', '_ven_impneto',  Decimal('0.01')),
    ('iva_global',  '_iva_global',   Decimal('0.01')),
]


class Command(BaseCommand):
    help = 'Compara TODOS los campos calculados (items + ventas) entre ORM y Vista SQL'

    def add_arguments(self, parser):
        parser.add_argument('--venta', type=int, default=None, help='ID de venta específica a verificar')
        parser.add_argument('--cantidad', type=int, default=20, help='Cantidad de ventas recientes a verificar (default 20)')
        parser.add_argument('--solo-errores', action='store_true', help='Mostrar solo diferencias')

    def handle(self, *args, **options):
        venta_id = options['venta']
        cantidad = options['cantidad']
        solo_errores = options['solo_errores']
        verbosity = options['verbosity']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n{"="*80}\n'
            f'  VERIFICACIÓN EXHAUSTIVA: ORM vs Vista SQL (todos los campos)\n'
            f'{"="*80}\n'
        ))

        # Determinar IDs de ventas a verificar
        if venta_id:
            venta_ids = [venta_id]
        else:
            with connection.cursor() as cursor:
                cursor.execute(f'SELECT DISTINCT vdi_idve FROM "VENTADETALLEITEM_CALCULADO" ORDER BY vdi_idve DESC LIMIT %s', [cantidad])
                venta_ids = [row[0] for row in cursor.fetchall()]

        if not venta_ids:
            self.stdout.write(self.style.WARNING('No se encontraron ventas para verificar.'))
            return

        total_items = 0
        total_items_ok = 0
        total_items_error = 0
        errores_por_campo = {c[0]: 0 for c in CAMPOS_COMPARAR}
        errores_detalle = []

        for vid in venta_ids:
            self.stdout.write(self.style.MIGRATE_HEADING(f'\n  ── VENTA {vid} ──'))

            # --- Obtener items de SQL ---
            sql_items = self._obtener_items_sql(vid)
            
            # --- Obtener items de ORM ---
            orm_items = self._obtener_items_orm(vid)

            if not sql_items:
                self.stdout.write(self.style.WARNING(f'    Sin items en vista SQL'))
                continue
            if not orm_items:
                self.stdout.write(self.style.WARNING(f'    Sin items en ORM'))
                continue

            # Comparar item por item (por ID)
            for item_id, sql_data in sql_items.items():
                total_items += 1
                orm_data = orm_items.get(item_id)

                if not orm_data:
                    total_items_error += 1
                    self.stdout.write(self.style.ERROR(f'    ❌ Item {item_id}: existe en SQL pero no en ORM'))
                    continue

                diffs = []
                for campo_sql, campo_orm, umbral, es_decimal in CAMPOS_COMPARAR:
                    val_sql = sql_data.get(campo_sql)
                    val_orm = orm_data.get(campo_orm)

                    if val_sql is None and val_orm is None:
                        continue

                    if es_decimal:
                        val_sql_d = Decimal(str(val_sql or 0))
                        val_orm_d = Decimal(str(val_orm or 0))
                        diff = abs(val_sql_d - val_orm_d)
                        if diff > umbral:
                            diffs.append((campo_sql, val_sql_d, val_orm_d, diff))
                            errores_por_campo[campo_sql] += 1

                if diffs:
                    total_items_error += 1
                    detalle = sql_data.get('_detalle', f'Item {item_id}')
                    self.stdout.write(self.style.ERROR(
                        f'    ❌ Item {item_id} ({detalle}, cant={sql_data.get("vdi_cantidad", "?")}):'))
                    for campo, val_s, val_o, diff in diffs:
                        self.stdout.write(f'       → {campo}: SQL={val_s} | ORM={val_o} (Δ={diff})')
                    errores_detalle.append({'venta': vid, 'item': item_id, 'diffs': diffs})
                else:
                    total_items_ok += 1
                    if not solo_errores and verbosity >= 2:
                        self.stdout.write(self.style.SUCCESS(f'    ✅ Item {item_id}: OK'))

        # --- Verificar campos de cabecera de venta ---
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n\n  ── CABECERAS DE VENTA ──'))
        ventas_ok = 0
        ventas_error = 0
        self._verificar_cabeceras_venta(venta_ids, solo_errores, verbosity)

        # --- RESUMEN FINAL ---
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n{"="*80}'))
        self.stdout.write(f'  RESUMEN ITEMS: {total_items} verificados')
        self.stdout.write(self.style.SUCCESS(f'  ✅ Items OK: {total_items_ok}'))
        if total_items_error:
            self.stdout.write(self.style.ERROR(f'  ❌ Items con diferencias: {total_items_error}'))
            self.stdout.write(f'\n  Diferencias por campo:')
            for campo, cnt in sorted(errores_por_campo.items(), key=lambda x: -x[1]):
                if cnt > 0:
                    self.stdout.write(self.style.WARNING(f'    → {campo}: {cnt}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n  ✅ PARIDAD TOTAL en items.\n'))

    def _obtener_items_sql(self, venta_id):
        """Obtiene todos los items calculados de la vista SQL."""
        items = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        id, vdi_idve, vdi_orden, vdi_cantidad, vdi_costo,
                        vdi_bonifica, vdi_detalle1,
                        ali_porce, vdi_precio_unitario_final,
                        precio_unitario_sin_iva, iva_unitario,
                        bonif_monto_unit_neto, precio_unit_bonif_sin_iva,
                        precio_unitario_bonif_desc_sin_iva,
                        precio_unitario_bonificado_con_iva,
                        precio_unitario_bonificado,
                        subtotal_neto, iva_monto, total_item,
                        margen_monto, margen_porcentaje,
                        ven_descu1, ven_descu2
                    FROM "VENTADETALLEITEM_CALCULADO"
                    WHERE vdi_idve = %s
                    ORDER BY vdi_orden
                """, [venta_id])
                cols = [desc[0] for desc in cursor.description]
                for row in cursor.fetchall():
                    d = dict(zip(cols, row))
                    d['_detalle'] = d.get('vdi_detalle1', '')[:40]
                    items[d['id']] = d
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'    Error leyendo SQL: {e}'))
        return items

    def _obtener_items_orm(self, venta_id):
        """Obtiene todos los items calculados del ORM."""
        items = {}
        try:
            qs = VentaDetalleItem.objects.filter(vdi_idve=venta_id).con_calculos()
            for item in qs:
                d = {
                    'ali_porce': getattr(item, 'ali_porce', None),
                    'vdi_precio_unitario_final': item.vdi_precio_unitario_final,
                    'precio_unitario_sin_iva': getattr(item, 'precio_unitario_sin_iva', None),
                    'iva_unitario': getattr(item, 'iva_unitario', None),
                    'bonif_monto_unit_neto': getattr(item, 'bonif_monto_unit_neto', None),
                    'precio_unit_bonif_sin_iva': getattr(item, 'precio_unit_bonif_sin_iva', None),
                    'precio_unitario_bonif_desc_sin_iva': getattr(item, 'precio_unitario_bonif_desc_sin_iva', None),
                    'precio_unitario_bonificado_con_iva': getattr(item, 'precio_unitario_bonificado_con_iva', None),
                    'precio_unitario_bonificado': getattr(item, 'precio_unitario_bonificado', None),
                    'subtotal_neto': getattr(item, 'subtotal_neto', None),
                    'iva_monto': getattr(item, 'iva_monto', None),
                    'total_item': getattr(item, 'total_item', None),
                    'margen_monto': getattr(item, 'margen_monto', None),
                    'margen_porcentaje': getattr(item, 'margen_porcentaje', None),
                    'vdi_cantidad': item.vdi_cantidad,
                    'vdi_detalle1': item.vdi_detalle1,
                }
                items[item.id] = d
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'    Error leyendo ORM: {e}'))
        return items

    def _verificar_cabeceras_venta(self, venta_ids, solo_errores, verbosity):
        """Compara campos agregados a nivel de venta."""
        from ferreapps.ventas.models import Venta

        # SQL
        sql_data = {}
        try:
            placeholders = ','.join(['%s'] * len(venta_ids))
            with connection.cursor() as cursor:
                cursor.execute(
                    f'SELECT ven_id, ven_total, ven_impneto, iva_global, numero_formateado '
                    f'FROM "VENTA_CALCULADO" WHERE ven_id IN ({placeholders})',
                    venta_ids
                )
                for row in cursor.fetchall():
                    sql_data[row[0]] = {
                        'ven_total': Decimal(str(row[1] or 0)),
                        'ven_impneto': Decimal(str(row[2] or 0)),
                        'iva_global': Decimal(str(row[3] or 0)),
                        'numero_formateado': (row[4] or '').strip(),
                    }
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  Error leyendo cabeceras SQL: {e}'))
            return

        # ORM
        ventas_orm = Venta.objects.con_calculos().filter(ven_id__in=venta_ids)
        ok = 0
        errores = 0
        for v in ventas_orm:
            sql = sql_data.get(v.ven_id)
            if not sql:
                continue

            orm_vals = {
                'ven_total': Decimal(str(getattr(v, '_ven_total', 0) or 0)),
                'ven_impneto': Decimal(str(getattr(v, '_ven_impneto', 0) or 0)),
                'iva_global': Decimal(str(getattr(v, '_iva_global', 0) or 0)),
                'numero_formateado': (getattr(v, '_numero_formateado', '') or '').strip(),
            }

            diffs = []
            for campo in ['ven_total', 'ven_impneto', 'iva_global']:
                diff = abs(orm_vals[campo] - sql[campo])
                if diff > Decimal('0.01'):
                    diffs.append((campo, sql[campo], orm_vals[campo], diff))

            if orm_vals['numero_formateado'] != sql['numero_formateado']:
                diffs.append(('numero_formateado', sql['numero_formateado'], orm_vals['numero_formateado'], '-'))

            if diffs:
                errores += 1
                self.stdout.write(self.style.ERROR(f'  ❌ VENTA {v.ven_id}:'))
                for campo, vs, vo, d in diffs:
                    self.stdout.write(f'     → {campo}: SQL={vs} | ORM={vo} (Δ={d})')
            else:
                ok += 1
                if not solo_errores and verbosity >= 2:
                    self.stdout.write(self.style.SUCCESS(
                        f'  ✅ VENTA {v.ven_id}: total=${orm_vals["ven_total"]} neto=${orm_vals["ven_impneto"]} '
                        f'iva=${orm_vals["iva_global"]} num={orm_vals["numero_formateado"]}'
                    ))
        
        self.stdout.write(f'\n  Cabeceras: {ok + errores} verificadas, {ok} OK, {errores} errores')
