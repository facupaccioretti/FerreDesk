from django.db import migrations, models


def clasificar_movimientos_historicos(apps, schema_editor):
    Cheque = apps.get_model('caja', 'Cheque')
    MovimientoCaja = apps.get_model('caja', 'MovimientoCaja')

    ids_custodia = set(
        Cheque.objects.exclude(movimiento_caja_entrada_id=None).values_list(
            'movimiento_caja_entrada_id', flat=True
        )
    )
    ids_custodia.update(
        Cheque.objects.exclude(movimiento_caja_salida_id=None)
        .exclude(origen_tipo='CAMBIO_CHEQUE')
        .values_list('movimiento_caja_salida_id', flat=True)
    )

    if ids_custodia:
        MovimientoCaja.objects.filter(pk__in=ids_custodia).update(afecta_efectivo=False)

    MovimientoCaja.objects.filter(
        descripcion__contains='cheque rechazado'
    ).update(afecta_efectivo=False)


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0019_pagoventa_postventa_operacion_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimientocaja',
            name='afecta_efectivo',
            field=models.BooleanField(
                db_column='MOV_AFECTA_EFECTIVO',
                default=True,
                help_text='Indica si el movimiento modifica el efectivo del arqueo',
            ),
        ),
        migrations.RunPython(
            clasificar_movimientos_historicos,
            migrations.RunPython.noop,
        ),
        migrations.AddIndex(
            model_name='movimientocaja',
            index=models.Index(
                fields=['sesion_caja', 'afecta_efectivo'],
                name='caja_mov_sesion_efe_idx',
            ),
        ),
    ]
