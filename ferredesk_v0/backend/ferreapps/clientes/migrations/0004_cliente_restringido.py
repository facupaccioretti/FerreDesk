from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('clientes', '0003_cliente_lista_precio_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='cliente',
            name='restringido',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
