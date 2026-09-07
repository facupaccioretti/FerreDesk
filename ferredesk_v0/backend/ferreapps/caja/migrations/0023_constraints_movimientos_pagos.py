from django.db import migrations, models


TIPOS_PAGO_VALIDOS = [
    'COBRO_VENTA',
    'VUELTO_VENTA',
    'DEVOLUCION_CLIENTE',
    'COBRO_DIFERENCIA_CAMBIO',
    'COBRO_RECIBO',
    'PAGO_ORDEN_PAGO',
]


def validar_datos_existentes(apps, schema_editor):
    MovimientoCaja = apps.get_model('caja', 'MovimientoCaja')
    PagoVenta = apps.get_model('caja', 'PagoVenta')
    errores = []

    movimientos_monto = list(
        MovimientoCaja.objects.filter(monto__lte=0).values_list('id', flat=True)[:20]
    )
    if movimientos_monto:
        errores.append(f'MovimientoCaja con monto no positivo: {movimientos_monto}')

    movimientos_tipo = list(
        MovimientoCaja.objects.exclude(tipo__in=['ENTRADA', 'SALIDA']).values_list('id', flat=True)[:20]
    )
    if movimientos_tipo:
        errores.append(f'MovimientoCaja con tipo invalido: {movimientos_tipo}')

    pagos_monto = list(PagoVenta.objects.filter(monto__lte=0).values_list('id', flat=True)[:20])
    if pagos_monto:
        errores.append(f'PagoVenta con monto no positivo: {pagos_monto}')

    pagos_bruto = list(
        PagoVenta.objects.filter(
            monto_recibido__isnull=False,
            monto_recibido__lt=models.F('monto'),
        ).values_list('id', flat=True)[:20]
    )
    if pagos_bruto:
        errores.append(f'PagoVenta con monto_recibido menor al neto: {pagos_bruto}')

    pagos_tipo = list(
        PagoVenta.objects.exclude(tipo_operacion__in=TIPOS_PAGO_VALIDOS).values_list('id', flat=True)[:20]
    )
    if pagos_tipo:
        errores.append(f'PagoVenta con tipo_operacion invalido: {pagos_tipo}')

    if errores:
        raise RuntimeError('No se pueden crear constraints de caja. ' + ' | '.join(errores))


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0022_sesion_caja_unica_abierta'),
    ]

    operations = [
        migrations.RunPython(validar_datos_existentes, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='movimientocaja',
            constraint=models.CheckConstraint(
                check=models.Q(('monto__gt', 0)),
                name='caja_mov_monto_positivo',
            ),
        ),
        migrations.AddConstraint(
            model_name='movimientocaja',
            constraint=models.CheckConstraint(
                check=models.Q(('tipo__in', ['ENTRADA', 'SALIDA'])),
                name='caja_mov_tipo_valido',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=models.Q(('monto__gt', 0)),
                name='caja_pago_monto_positivo',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=models.Q(('monto_recibido__isnull', True), ('monto_recibido__gte', models.F('monto')), _connector='OR'),
                name='caja_pago_bruto_mayor_neto',
            ),
        ),
        migrations.AddConstraint(
            model_name='pagoventa',
            constraint=models.CheckConstraint(
                check=models.Q(('tipo_operacion__in', [
                    *TIPOS_PAGO_VALIDOS,
                ])),
                name='caja_pago_tipo_valido',
            ),
        ),
    ]
