"""
Management command: verificar_cuenta_corriente
Verifica la integridad de los cálculos de cuenta corriente (clientes y proveedores)
usando el servicio ORM refactorizado.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import connection

from ferreapps.cuenta_corriente.services.cuenta_corriente_service import (
    obtener_movimientos_cliente,
    obtener_movimientos_proveedor,
)
from ferreapps.ventas.models import Venta
from ferreapps.clientes.models import Cliente
from ferreapps.productos.models import Proveedor


class Command(BaseCommand):
    help = 'Verifica la integridad de cálculos de cuenta corriente (clientes y proveedores)'

    def add_arguments(self, parser):
        parser.add_argument('--tipo', choices=['clientes', 'proveedores', 'ambos'], default='ambos',
                            help='Tipo de CC a verificar (default: ambos)')
        parser.add_argument('--id', type=int, default=None,
                            help='ID específico de cliente/proveedor a verificar')
        parser.add_argument('--cantidad', type=int, default=10,
                            help='Cantidad de cuentas a verificar (default: 10)')

    def handle(self, *args, **options):
        tipo = options['tipo']
        id_especifico = options['id']
        cantidad = options['cantidad']
        verbosity = options['verbosity']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n{"="*70}\n'
            f'  VERIFICACIÓN DE CUENTAS CORRIENTES (ORM)\n'
            f'  Tipo: {tipo} | Cantidad: {cantidad}\n'
            f'{"="*70}\n'
        ))

        errores_totales = 0

        if tipo in ('clientes', 'ambos'):
            errores_totales += self._verificar_clientes(id_especifico, cantidad, verbosity)

        if tipo in ('proveedores', 'ambos'):
            errores_totales += self._verificar_proveedores(id_especifico, cantidad, verbosity)

        # Resumen final
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n{"="*70}'))
        if errores_totales:
            self.stdout.write(self.style.ERROR(f'  ❌ {errores_totales} error(es) encontrado(s)\n'))
        else:
            self.stdout.write(self.style.SUCCESS(f'  ✅ Todas las verificaciones pasaron correctamente.\n'))

    def _verificar_movimientos(self, movimientos, entity_label, entity_id, verbosity):
        """Verifica la integridad de una lista de movimientos de CC."""
        errores = 0
        total_debe = Decimal('0.00')
        total_haber = Decimal('0.00')
        pendiente_negativo = False

        for mov in movimientos:
            debe = Decimal(str(mov.get('debe', 0) or 0))
            haber = Decimal(str(mov.get('haber', 0) or 0))
            saldo_pendiente = Decimal(str(mov.get('saldo_pendiente', 0) or 0))
            total = Decimal(str(mov.get('total', 0) or 0))

            total_debe += debe
            total_haber += haber

            # Verificar que no haya saldos pendientes negativos
            if saldo_pendiente < -Decimal('0.01'):
                pendiente_negativo = True
                errores += 1
                comp = mov.get('comprobante_nombre', '?')
                num = mov.get('numero_formateado', '?')
                self.stdout.write(self.style.ERROR(
                    f'    ❌ {entity_label} (ID={entity_id}): '
                    f'Pendiente negativo ${saldo_pendiente} en {comp} {num} (id={mov.get("id")})'
                ))

            # Verificar que total no sea negativo (inconsistencia rara)
            if total < -Decimal('0.01') and debe > 0:
                errores += 1
                self.stdout.write(self.style.ERROR(
                    f'    ❌ {entity_label} (ID={entity_id}): '
                    f'Total negativo ${total} en movimiento id={mov.get("id")}'
                ))

        saldo = total_debe - total_haber
        sql_data = self._obtener_sql_cc(entity_label, entity_id)
        
        # Comparar saldos
        if sql_data['exists']:
            diff = abs(saldo - sql_data['saldo_sql'])
            if diff > Decimal('0.05'):
                sql_data['diffs'] = f"ORM=${saldo} vs SQL=${sql_data['saldo_sql']} (Δ={diff})"
        
        if verbosity >= 2:
            style = self.style.SUCCESS if (errores == 0 and not sql_data.get('diffs')) else self.style.WARNING
            self.stdout.write(style(
                f'    {"✅" if errores == 0 and not sql_data.get("diffs") else "❌"} {entity_label} (ID={entity_id}): '
                f'{len(movimientos)} movs | debe=${total_debe} haber=${total_haber} saldo=${saldo}'
            ))
            
            if sql_data.get('diffs'):
                self.stdout.write(self.style.ERROR(f'      ❌ DIFERENCIA CON SQL: {sql_data["diffs"]}'))
            elif sql_data.get('exists'):
                self.stdout.write(self.style.SUCCESS(f'      ✅ COINCIDE CON SQL (saldo=${sql_data["saldo_sql"]})'))

            # Mostrar detalle de movimientos si hay pocos o verbosity alto
            if verbosity >= 3 or (verbosity == 2 and len(movimientos) <= 15):
                for mov in movimientos:
                    debe = Decimal(str(mov.get('debe', 0) or 0))
                    haber = Decimal(str(mov.get('haber', 0) or 0))
                    pend = Decimal(str(mov.get('saldo_pendiente', 0) or 0))
                    comp = mov.get('comprobante_nombre', '?')
                    num = mov.get('numero_formateado', '?')
                    lado = f'D=${debe}' if debe > 0 else f'H=${haber}'
                    self.stdout.write(f'      {comp} {num}: {lado} pend=${pend}')

        return errores + (1 if sql_data.get('diffs') else 0)

    def _obtener_sql_cc(self, label, entity_id):
        """Intenta obtener el saldo de la vista SQL para comparar."""
        res = {'exists': False, 'saldo_sql': 0, 'diffs': None}
        table = None
        col_id = None
        
        if 'Cliente' in label:
            table = 'CUENTA_CORRIENTE_CLIENTE'
            col_id = 'ven_idcli'
        elif 'Proveedor' in label:
            table = 'CUENTA_CORRIENTE_PROVEEDOR'
            col_id = 'mov_proveedor_id'
            
        if not table: return res
        
        try:
            with connection.cursor() as cursor:
                # Calculamos el saldo de la vista SQL (Debe - Haber)
                cursor.execute(f'SELECT SUM(debe - haber) FROM "{table}" WHERE {col_id} = %s', [entity_id])
                row = cursor.fetchone()
                if row and row[0] is not None:
                    res['exists'] = True
                    res['saldo_sql'] = Decimal(str(row[0]))
        except Exception:
            pass # La vista podría no existir o tener otros nombres de columna
            
        return res

    def _verificar_clientes(self, id_especifico, cantidad, verbosity):
        self.stdout.write(self.style.MIGRATE_HEADING('\n  📋 CLIENTES'))
        errores = 0

        if id_especifico:
            clientes_ids = [id_especifico]
        else:
            clientes_ids = list(
                Venta.objects.exclude(ven_estado='AN')
                .values_list('ven_idcli', flat=True)
                .distinct()[:cantidad]
            )

        for cli_id in clientes_ids:
            try:
                cliente = Cliente.objects.filter(id=cli_id).first()
                nombre = cliente.razon if cliente else f'ID:{cli_id}'

                movimientos = obtener_movimientos_cliente(cli_id, completo=True)

                if not movimientos:
                    if verbosity >= 2:
                        self.stdout.write(f'    ⏭️  Cliente {nombre}: sin movimientos')
                    continue

                errores += self._verificar_movimientos(movimientos, f'Cliente {nombre}', cli_id, verbosity)

            except Exception as e:
                errores += 1
                self.stdout.write(self.style.ERROR(
                    f'    ❌ Cliente ID={cli_id}: Error → {e}'
                ))

        self.stdout.write(f'    Verificados: {len(clientes_ids)} clientes, {errores} error(es)')
        return errores

    def _verificar_proveedores(self, id_especifico, cantidad, verbosity):
        self.stdout.write(self.style.MIGRATE_HEADING('\n  📋 PROVEEDORES'))
        errores = 0

        if id_especifico:
            prov_ids = [id_especifico]
        else:
            prov_ids = list(
                Proveedor.objects.filter(acti='S')
                .values_list('id', flat=True)[:cantidad]
            )

        for prov_id in prov_ids:
            try:
                proveedor = Proveedor.objects.filter(id=prov_id).first()
                nombre = proveedor.razon if proveedor else f'ID:{prov_id}'

                movimientos = obtener_movimientos_proveedor(prov_id, completo=True)

                if not movimientos:
                    if verbosity >= 2:
                        self.stdout.write(f'    ⏭️  Proveedor {nombre}: sin movimientos')
                    continue

                errores += self._verificar_movimientos(movimientos, f'Proveedor {nombre}', prov_id, verbosity)

            except Exception as e:
                errores += 1
                self.stdout.write(self.style.ERROR(
                    f'    ❌ Proveedor ID={prov_id}: Error → {e}'
                ))

        self.stdout.write(f'    Verificados: {len(prov_ids)} proveedores, {errores} error(es)')
        return errores

