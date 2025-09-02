from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0002_vistas_productos'),
        ('compras', '0002_alter_compradetalleitem_cdi_detalle1'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrdenCompra',
            fields=[
                ('ord_id', models.AutoField(db_column='ORD_ID', primary_key=True, serialize=False)),
                ('ord_sucursal', models.SmallIntegerField(db_column='ORD_SUCURSAL')),
                ('ord_fecha', models.DateField(db_column='ORD_FECHA')),
                ('ord_hora_creacion', models.TimeField(auto_now_add=True, db_column='ORD_HORA_CREACION')),
                ('ord_numero', models.CharField(db_column='ORD_NUMERO', help_text='Número de orden interno (formato: O-0001-00000009)', max_length=50)),
                ('ord_cuit', models.CharField(blank=True, db_column='ORD_CUIT', max_length=20, null=True)),
                ('ord_razon_social', models.CharField(blank=True, db_column='ORD_RAZON_SOCIAL', max_length=100, null=True)),
                ('ord_domicilio', models.CharField(blank=True, db_column='ORD_DOMICILIO', max_length=100, null=True)),
                ('ord_observacion', models.TextField(blank=True, db_column='ORD_OBSERVACION', null=True)),
                ('ord_idpro', models.ForeignKey(db_column='ORD_IDPRO', on_delete=django.db.models.deletion.PROTECT, related_name='ordenes_compra', to='productos.proveedor')),
            ],
            options={
                'verbose_name': 'Orden de Compra',
                'verbose_name_plural': 'Órdenes de Compra',
                'db_table': 'ORDENES_COMPRA',
            },
        ),
        migrations.CreateModel(
            name='OrdenCompraDetalleItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('odi_orden', models.SmallIntegerField(db_column='ODI_ORDEN')),
                ('odi_cantidad', models.DecimalField(db_column='ODI_CANTIDAD', decimal_places=2, max_digits=9, validators=[django.core.validators.MinValueValidator(0.01)])),
                ('odi_detalle1', models.CharField(db_column='ODI_DETALLE1', max_length=200)),
                ('odi_detalle2', models.CharField(blank=True, db_column='ODI_DETALLE2', max_length=40, null=True)),
                ('odi_idor', models.ForeignKey(db_column='ODI_IDOR', on_delete=django.db.models.deletion.CASCADE, related_name='items', to='compras.ordencompra')),
                ('odi_idpro', models.ForeignKey(db_column='ODI_IDPRO', on_delete=django.db.models.deletion.PROTECT, related_name='ordenes_compra_items', to='productos.proveedor')),
                ('odi_idsto', models.ForeignKey(blank=True, db_column='ODI_IDSTO', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ordenes_compra_items', to='productos.stock')),
            ],
            options={
                'verbose_name': 'Item de Orden de Compra',
                'verbose_name_plural': 'Items de Orden de Compra',
                'db_table': 'ORDEN_COMPRA_DETAITEM',
                'ordering': ['odi_orden'],
            },
        ),
        # Índices siguiendo el patrón exacto del sistema
        migrations.AddIndex(
            model_name='ordencompra',
            index=models.Index(fields=['ord_fecha'], name='ORDENES_COM_ORD_FEC_70b94f_idx'),
        ),
        migrations.AddIndex(
            model_name='ordencompra',
            index=models.Index(fields=['ord_idpro'], name='ORDENES_COM_ORD_IDP_74b030_idx'),
        ),
        migrations.AddIndex(
            model_name='ordencompra',
            index=models.Index(fields=['ord_numero'], name='ORDENES_COM_ORD_NUM_b7fd4f_idx'),
        ),
        migrations.AddIndex(
            model_name='ordencompradetalleitem',
            index=models.Index(fields=['odi_idor'], name='ORDEN_COMPR_ODI_IDO_9f8ada_idx'),
        ),
        migrations.AddIndex(
            model_name='ordencompradetalleitem',
            index=models.Index(fields=['odi_idsto'], name='ORDEN_COMPR_ODI_IDS_ea3175_idx'),
        ),
        migrations.AddIndex(
            model_name='ordencompradetalleitem',
            index=models.Index(fields=['odi_idpro'], name='ORDEN_COMPR_ODI_IDP_165eda_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='ordencompra',
            unique_together={('ord_numero', 'ord_idpro')},
        ),
    ]
