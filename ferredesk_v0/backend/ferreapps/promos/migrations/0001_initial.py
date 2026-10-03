import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('productos', '0020_stock_stock_deno_trgm_idx'),
    ]

    operations = [
        migrations.CreateModel(
            name='Promocion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=150)),
                ('descripcion', models.TextField(blank=True, default='')),
                ('precio_promocional', models.DecimalField(decimal_places=2, max_digits=15)),
                ('activa', models.BooleanField(default=True)),
                ('fecha_inicio', models.DateField(blank=True, null=True)),
                ('fecha_fin', models.DateField(blank=True, null=True)),
                ('desactualizada', models.BooleanField(default=False)),
                ('fecha_desactualizacion', models.DateTimeField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Promocion',
                'verbose_name_plural': 'Promociones',
                'db_table': 'PROMOCIONES',
            },
        ),
        migrations.CreateModel(
            name='PromocionItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.DecimalField(decimal_places=2, max_digits=15)),
                ('promocion', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='promos.promocion')),
                ('stock', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='promociones_items', to='productos.stock')),
            ],
            options={
                'verbose_name': 'Item de Promocion',
                'verbose_name_plural': 'Items de Promocion',
                'db_table': 'PROMOCIONES_ITEMS',
            },
        ),
        migrations.AddIndex(
            model_name='promocion',
            index=models.Index(fields=['activa'], name='PROMOCIONES_activa_3fe315_idx'),
        ),
        migrations.AddIndex(
            model_name='promocion',
            index=models.Index(fields=['desactualizada'], name='PROMOCIONES_desactu_7a839d_idx'),
        ),
        migrations.AddIndex(
            model_name='promocionitem',
            index=models.Index(fields=['stock'], name='PROMOCIONES_stock_i_dbb54b_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='promocionitem',
            unique_together={('promocion', 'stock')},
        ),
    ]
