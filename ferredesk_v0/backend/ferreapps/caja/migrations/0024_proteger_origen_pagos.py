import django.db.models.deletion
from django.db import migrations, models


def validar_pagos(apps, schema_editor):
    PagoVenta = apps.get_model('caja', 'PagoVenta')
    invalidos = []
    campos = ('id', 'venta_id', 'recibo_id', 'orden_pago_id', 'postventa_operacion_id', 'tipo_operacion')
    for pago in PagoVenta.objects.values(*campos).iterator():
        origenes = sum(pago[campo] is not None for campo in ('venta_id', 'recibo_id', 'orden_pago_id'))
        tipo = pago['tipo_operacion']
        coherente = (
            (tipo in {'COBRO_VENTA', 'VUELTO_VENTA'} and pago['venta_id'] is not None)
            or (
                tipo in {'DEVOLUCION_CLIENTE', 'COBRO_DIFERENCIA_CAMBIO'}
                and pago['venta_id'] is not None
                and pago['postventa_operacion_id'] is not None
            )
            or (tipo == 'COBRO_RECIBO' and pago['recibo_id'] is not None and pago['postventa_operacion_id'] is None)
            or (tipo == 'PAGO_ORDEN_PAGO' and pago['orden_pago_id'] is not None and pago['postventa_operacion_id'] is None)
        )
        if origenes != 1 or (pago['postventa_operacion_id'] is not None and pago['venta_id'] is None) or not coherente:
            invalidos.append(pago['id'])
            if len(invalidos) == 20:
                break
    if invalidos:
        raise RuntimeError(f'Pagos con origen invalido; corrija antes de migrar: {invalidos}')


class Migration(migrations.Migration):
    dependencies = [
        ('caja', '0023_constraints_movimientos_pagos'),
    ]

    operations = [
        migrations.RunPython(validar_pagos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pagoventa',
            name='cuenta_banco',
            field=models.ForeignKey(
                blank=True,
                db_column='cuenta_banco_id',
                help_text='Cuenta bancaria/billetera destino del pago (transferencia/QR)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pagos_venta',
                to='caja.cuentabanco',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(venta__isnull=False, recibo__isnull=True, orden_pago__isnull=True)
                    | models.Q(venta__isnull=True, recibo__isnull=False, orden_pago__isnull=True)
                    | models.Q(venta__isnull=True, recibo__isnull=True, orden_pago__isnull=False)
                ),
                name='caja_pago_origen_unico',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=models.Q(postventa_operacion__isnull=True) | models.Q(venta__isnull=False),
                name='caja_pago_postventa_con_venta',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        tipo_operacion__in=['COBRO_VENTA', 'VUELTO_VENTA'],
                        venta__isnull=False,
                        recibo__isnull=True,
                        orden_pago__isnull=True,
                    )
                    | models.Q(
                        tipo_operacion__in=['DEVOLUCION_CLIENTE', 'COBRO_DIFERENCIA_CAMBIO'],
                        venta__isnull=False,
                        recibo__isnull=True,
                        orden_pago__isnull=True,
                        postventa_operacion__isnull=False,
                    )
                    | models.Q(
                        tipo_operacion='COBRO_RECIBO',
                        venta__isnull=True,
                        recibo__isnull=False,
                        orden_pago__isnull=True,
                        postventa_operacion__isnull=True,
                    )
                    | models.Q(
                        tipo_operacion='PAGO_ORDEN_PAGO',
                        venta__isnull=True,
                        recibo__isnull=True,
                        orden_pago__isnull=False,
                        postventa_operacion__isnull=True,
                    )
                ),
                name='caja_pago_tipo_origen_coherente',
            ),
        ),
    ]
