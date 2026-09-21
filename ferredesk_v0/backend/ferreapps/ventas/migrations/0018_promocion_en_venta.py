import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0017_venta_ajuste_redondeo'),
        ('productos', '0020_stock_stock_deno_trgm_idx'),
        ('promos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ventadetalleitem',
            name='vdi_promocion',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                db_column='VDI_IDPROMOCION',
                related_name='ventas_detalles',
                to='promos.promocion',
            ),
        ),
        migrations.AddIndex(
            model_name='ventadetalleitem',
            index=models.Index(fields=['vdi_promocion'], name='VENTA_DETAI_VDI_IDP_dcdbda_idx'),
        ),
        migrations.AddConstraint(
            model_name='ventadetalleitem',
            constraint=models.CheckConstraint(
                check=models.Q(('vdi_promocion__isnull', True)) | models.Q(('vdi_idsto__isnull', True)),
                name='vdi_promocion_excluye_idsto',
            ),
        ),
        migrations.CreateModel(
            name='VentaPromocionComponente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad_por_promo', models.DecimalField(db_column='VPC_CANTIDAD_POR_PROMO', decimal_places=2, max_digits=15)),
                ('costo_unitario', models.DecimalField(db_column='VPC_COSTO_UNITARIO', decimal_places=3, max_digits=15)),
                ('detalle', models.ForeignKey(db_column='VPC_IDVDI', on_delete=django.db.models.deletion.CASCADE, related_name='componentes_promocion', to='ventas.ventadetalleitem')),
                ('proveedor', models.ForeignKey(db_column='VPC_IDPRO', on_delete=django.db.models.deletion.PROTECT, to='productos.proveedor')),
                ('stock', models.ForeignKey(db_column='VPC_IDSTO', on_delete=django.db.models.deletion.PROTECT, to='productos.stock')),
            ],
            options={
                'verbose_name': 'Componente de Promocion Vendida',
                'verbose_name_plural': 'Componentes de Promociones Vendidas',
                'db_table': 'VENTA_PROMOCION_COMPONENTE',
            },
        ),
        migrations.AddIndex(
            model_name='ventapromocioncomponente',
            index=models.Index(fields=['detalle'], name='VENTA_PROMO_VPC_IDV_72e92f_idx'),
        ),
        migrations.AddIndex(
            model_name='ventapromocioncomponente',
            index=models.Index(fields=['stock', 'proveedor'], name='VENTA_PROMO_VPC_IDS_9fc4e5_idx'),
        ),
        migrations.CreateModel(
            name='VentaDetalleItemPromoAlicuota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('neto', models.DecimalField(db_column='VDA_NETO', decimal_places=2, max_digits=15)),
                ('iva_monto', models.DecimalField(db_column='VDA_IVA_MONTO', decimal_places=2, max_digits=15)),
                ('alicuota', models.ForeignKey(db_column='VDA_IDALIIVA', on_delete=django.db.models.deletion.PROTECT, to='productos.alicuotaiva')),
                ('detalle', models.ForeignKey(db_column='VDA_IDVDI', on_delete=django.db.models.deletion.CASCADE, related_name='promo_alicuotas', to='ventas.ventadetalleitem')),
            ],
            options={
                'verbose_name': 'Desglose de IVA de Promocion Vendida',
                'verbose_name_plural': 'Desgloses de IVA de Promociones Vendidas',
                'db_table': 'VENTA_DETALLE_PROMO_ALICUOTA',
            },
        ),
        migrations.AddIndex(
            model_name='ventadetalleitempromoalicuota',
            index=models.Index(fields=['detalle'], name='VENTA_DETAL_VDA_IDV_f9be89_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='ventadetalleitempromoalicuota',
            unique_together={('detalle', 'alicuota')},
        ),
    ]
