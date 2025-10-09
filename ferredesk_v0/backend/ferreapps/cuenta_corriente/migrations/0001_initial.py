# Generated migration for Cuenta Corriente

from django.db import migrations, models
from django.db.models import Q
from django.core.validators import MinValueValidator
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('ventas', '0003_nuevas_vistas'),  # Depende de la migración que crea la vista VENTA_CALCULADO
        ('clientes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImputacionVenta',
            fields=[
                ('imp_id', models.AutoField(db_column='IMP_ID', primary_key=True, serialize=False)),
                ('imp_fecha', models.DateField(db_column='IMP_FECHA')),
                ('imp_monto', models.DecimalField(db_column='IMP_MONTO', decimal_places=2, max_digits=15, validators=[MinValueValidator(Decimal('0.01'))])),
                ('imp_observacion', models.CharField(blank=True, db_column='IMP_OBSERVACION', max_length=200, null=True)),
                ('imp_id_venta', models.ForeignKey(db_column='IMP_ID_VENTA', help_text='Factura que está siendo imputada', on_delete=models.deletion.PROTECT, related_name='imputaciones_recibidas', to='ventas.venta')),
                ('imp_id_recibo', models.ForeignKey(db_column='IMP_ID_RECIBO', help_text='Recibo o crédito que está realizando la imputación', on_delete=models.deletion.PROTECT, related_name='imputaciones_realizadas', to='ventas.venta')),
            ],
            options={
                'verbose_name': 'Imputación de Venta',
                'verbose_name_plural': 'Imputaciones de Ventas',
                'db_table': 'IMPUTACION_VENTA',
            },
        ),
        migrations.AddConstraint(
            model_name='imputacionventa',
            constraint=models.CheckConstraint(check=models.Q(('imp_monto__gt', 0)), name='imp_monto_positivo'),
        ),
        migrations.AddConstraint(
            model_name='imputacionventa',
            constraint=models.CheckConstraint(check=~models.Q(('imp_id_venta', models.F('imp_id_recibo'))), name='no_autoimputacion_directa'),
        ),
        migrations.AlterUniqueTogether(
            name='imputacionventa',
            unique_together={('imp_id_venta', 'imp_id_recibo', 'imp_fecha')},
        ),
        migrations.AddIndex(
            model_name='imputacionventa',
            index=models.Index(fields=['imp_id_venta'], name='imputacion_venta_idx'),
        ),
        migrations.AddIndex(
            model_name='imputacionventa',
            index=models.Index(fields=['imp_id_recibo'], name='imputacion_recibo_idx'),
        ),
        migrations.AddIndex(
            model_name='imputacionventa',
            index=models.Index(fields=['imp_fecha'], name='imputacion_fecha_idx'),
        ),
        migrations.AddIndex(
            model_name='imputacionventa',
            index=models.Index(fields=['imp_id_venta', 'imp_fecha'], name='imputacion_venta_fecha_idx'),
        ),
        migrations.CreateModel(
            name='CuentaCorrienteCliente',
            fields=[
                ('ven_id', models.IntegerField(primary_key=True, serialize=False)),
                ('ven_fecha', models.DateField()),
                ('ven_idcli', models.IntegerField()),
                ('comprobante_nombre', models.CharField(max_length=50)),
                ('comprobante_tipo', models.CharField(max_length=30)),
                ('debe', models.DecimalField(decimal_places=2, max_digits=15)),
                ('haber', models.DecimalField(decimal_places=2, max_digits=15)),
                ('saldo_acumulado', models.DecimalField(decimal_places=2, max_digits=15)),
                ('saldo_pendiente', models.DecimalField(decimal_places=2, max_digits=15)),
                ('es_fac_rcbo', models.BooleanField()),
                ('ven_total', models.DecimalField(decimal_places=2, max_digits=15)),
                ('numero_formateado', models.CharField(max_length=50)),
            ],
            options={
                'db_table': 'CUENTA_CORRIENTE_CLIENTE',
                'managed': False,
            },
        ),
        # Vista 1: Sumarización por imp_id_venta (cuánto se le ha imputado a cada factura)
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE VIEW "VISTA_IMPUTACIONES_RECIBIDAS" AS
            SELECT 
                imp."IMP_ID_VENTA" as venta_id,
                SUM(imp."IMP_MONTO") as monto_total_imputado
            FROM "IMPUTACION_VENTA" imp
            GROUP BY imp."IMP_ID_VENTA";
            """,
            reverse_sql='DROP VIEW IF EXISTS "VISTA_IMPUTACIONES_RECIBIDAS";'
        ),
        
        # Vista 2: Sumarización por imp_id_recibo (cuánto se ha usado de cada recibo)
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE VIEW "VISTA_IMPUTACIONES_REALIZADAS" AS
            SELECT 
                imp."IMP_ID_RECIBO" as recibo_id,
                SUM(imp."IMP_MONTO") as monto_total_usado
            FROM "IMPUTACION_VENTA" imp
            GROUP BY imp."IMP_ID_RECIBO";
            """,
            reverse_sql='DROP VIEW IF EXISTS "VISTA_IMPUTACIONES_REALIZADAS";'
        ),
        
        # Vista 3: CUENTA_CORRIENTE_CLIENTE basada en VENTA_CALCULADO (sin joins extra)
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE VIEW "CUENTA_CORRIENTE_CLIENTE" AS
            SELECT 
                vc.ven_id,
                vc.ven_fecha,
                vc.ven_idcli,
                vc.comprobante_nombre,
                vc.comprobante_tipo,
                CASE 
                    WHEN vc.comprobante_tipo IN ('factura', 'factura_interna') THEN vc.ven_total
                    ELSE 0
                END AS debe,
                CASE 
                    WHEN vc.comprobante_tipo IN ('recibo', 'nota_credito') THEN vc.ven_total
                    ELSE 0
                END AS haber,
                SUM(
                    CASE 
                        WHEN vc.comprobante_tipo IN ('factura', 'factura_interna') THEN vc.ven_total
                        WHEN vc.comprobante_tipo IN ('recibo', 'nota_credito') THEN -vc.ven_total
                        ELSE 0
                    END
                ) OVER (
                    PARTITION BY vc.ven_idcli 
                    ORDER BY vc.ven_fecha, vc.ven_id
                    ROWS UNBOUNDED PRECEDING
                ) AS saldo_acumulado,
                CASE 
                    WHEN vc.comprobante_tipo IN ('factura', 'factura_interna') THEN 
                        vc.ven_total - COALESCE((
                            SELECT SUM(imp."IMP_MONTO") 
                            FROM "IMPUTACION_VENTA" imp 
                            WHERE imp."IMP_ID_VENTA" = vc.ven_id
                        ), 0)
                    WHEN vc.comprobante_tipo IN ('recibo', 'nota_credito') THEN 
                        vc.ven_total - COALESCE((
                            SELECT SUM(imp."IMP_MONTO") 
                            FROM "IMPUTACION_VENTA" imp 
                            WHERE imp."IMP_ID_RECIBO" = vc.ven_id
                        ), 0)
                    ELSE 0
                END AS saldo_pendiente,
                false AS es_fac_rcbo,
                vc.ven_total,
                vc.numero_formateado
            FROM "VENTA_CALCULADO" vc
            WHERE vc.ven_estado != 'AN'
              AND vc.comprobante_tipo <> 'presupuesto'
            ORDER BY vc.ven_idcli, vc.ven_fecha, vc.ven_id;
            """,
            reverse_sql='DROP VIEW IF EXISTS "CUENTA_CORRIENTE_CLIENTE";'
        ),
    ]
