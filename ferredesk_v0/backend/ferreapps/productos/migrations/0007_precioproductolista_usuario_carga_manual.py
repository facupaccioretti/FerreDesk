from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('productos', '0006_limpiar_precios_calculados'),
    ]

    operations = [
        migrations.AddField(
            model_name='precioproductolista',
            name='usuario_carga_manual',
            field=models.ForeignKey(
                blank=True,
                db_column='USUARIO_CARGA_MANUAL',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
