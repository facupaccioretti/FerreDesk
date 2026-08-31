from django.db import migrations, models
from django.db.models import Count, Q


def validar_sesiones_abiertas(apps, schema_editor):
    SesionCaja = apps.get_model('caja', 'SesionCaja')
    duplicados = list(
        SesionCaja.objects.filter(estado='ABIERTA')
        .values('usuario_id')
        .annotate(total=Count('id'))
        .filter(total__gt=1)
        .values_list('usuario_id', flat=True)
    )
    if duplicados:
        ids = ', '.join(map(str, duplicados[:20]))
        raise RuntimeError(f'Usuarios con mas de una caja abierta: {ids}')


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0021_pagoventa_sesion_caja'),
    ]

    operations = [
        migrations.RunPython(validar_sesiones_abiertas, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='sesioncaja',
            constraint=models.UniqueConstraint(
                condition=Q(estado='ABIERTA'),
                fields=('usuario',),
                name='caja_una_sesion_abierta_por_usuario',
            ),
        ),
    ]
