import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0020_stock_stock_deno_trgm_idx'),
        ('promos', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PromocionGrupo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=150)),
                ('cantidad', models.DecimalField(decimal_places=2, max_digits=15)),
                ('orden', models.SmallIntegerField(default=0)),
                ('promocion', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='grupos', to='promos.promocion')),
            ],
            options={
                'verbose_name': 'Grupo de Promocion',
                'verbose_name_plural': 'Grupos de Promocion',
                'db_table': 'PROMOCIONES_GRUPOS',
                'ordering': ['orden', 'id'],
            },
        ),
        migrations.CreateModel(
            name='PromocionGrupoAlternativa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('grupo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alternativas', to='promos.promociongrupo')),
                ('stock', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='promociones_grupo_alternativas', to='productos.stock')),
            ],
            options={
                'verbose_name': 'Alternativa de Grupo de Promocion',
                'verbose_name_plural': 'Alternativas de Grupos de Promocion',
                'db_table': 'PROMOCIONES_GRUPOS_ALTERNATIVAS',
            },
        ),
        migrations.AddIndex(
            model_name='promociongrupo',
            index=models.Index(fields=['promocion'], name='PROMOCIONES_GRUPOS_promo_idx'),
        ),
        migrations.AddIndex(
            model_name='promociongrupoalternativa',
            index=models.Index(fields=['stock'], name='PROMOCIONES_GRUPOS_ALT_sto_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='promociongrupoalternativa',
            unique_together={('grupo', 'stock')},
        ),
    ]
