# Generated by Django 5.1.7 on 2025-05-12 05:36

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Barrio',
            fields=[
                ('id', models.AutoField(db_column='BAR_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='BAR_DENO', max_length=40)),
                ('cpostal', models.CharField(blank=True, db_column='BAR_CPOSTAL', max_length=10, null=True)),
                ('activo', models.CharField(db_column='BAR_ACTI', max_length=1)),
            ],
            options={
                'db_table': 'BARRIOS',
            },
        ),
        migrations.CreateModel(
            name='CategoriaCliente',
            fields=[
                ('id', models.AutoField(db_column='CAC_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='CAC_DENO', max_length=40)),
                ('activo', models.CharField(db_column='CAC_ACTI', max_length=1)),
            ],
            options={
                'db_table': 'CATEGORIA_CLIENTE',
            },
        ),
        migrations.CreateModel(
            name='Localidad',
            fields=[
                ('id', models.AutoField(db_column='LOC_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='LOC_DENO', max_length=40)),
                ('activo', models.CharField(db_column='LOC_ACTI', max_length=1)),
            ],
            options={
                'db_table': 'LOCALIDADES',
            },
        ),
        migrations.CreateModel(
            name='Plazo',
            fields=[
                ('id', models.AutoField(db_column='PLA_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='PLA_DENO', max_length=30)),
                ('activo', models.CharField(db_column='PLA_ACTI', max_length=1)),
            ],
            options={
                'db_table': 'PLAZOS',
            },
        ),
        migrations.CreateModel(
            name='Provincia',
            fields=[
                ('id', models.AutoField(db_column='PRV_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='PRV_DENO', max_length=40)),
                ('activo', models.CharField(blank=True, db_column='PRV_ACTI', max_length=1, null=True)),
            ],
            options={
                'db_table': 'PROVINCIAS',
            },
        ),
        migrations.CreateModel(
            name='TipoIVA',
            fields=[
                ('id', models.AutoField(db_column='TIV_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='TIV_DENO', max_length=30)),
            ],
            options={
                'db_table': 'TIPOSIVA',
            },
        ),
        migrations.CreateModel(
            name='Transporte',
            fields=[
                ('id', models.AutoField(db_column='TRA_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='TRA_DENO', max_length=40)),
                ('domicilio', models.CharField(blank=True, db_column='TRA_DOMI', max_length=40, null=True)),
                ('tel1', models.CharField(blank=True, db_column='TRA_TEL1', max_length=12, null=True)),
                ('tel2', models.CharField(blank=True, db_column='TRA_TEL2', max_length=12, null=True)),
                ('fax', models.CharField(blank=True, db_column='TRA_FAX', max_length=12, null=True)),
                ('cuit', models.CharField(blank=True, db_column='TRA_CUIT', max_length=11, null=True)),
                ('activo', models.CharField(db_column='TRA_ACTI', max_length=1)),
                ('localidad', models.ForeignKey(db_column='TRA_IDLOC', on_delete=django.db.models.deletion.PROTECT, to='clientes.localidad')),
            ],
            options={
                'db_table': 'TRANSPORTES',
            },
        ),
        migrations.CreateModel(
            name='Vendedor',
            fields=[
                ('id', models.AutoField(db_column='VDO_ID', primary_key=True, serialize=False)),
                ('nombre', models.CharField(db_column='VDO_DENO', max_length=40)),
                ('domicilio', models.CharField(blank=True, db_column='VDO_DOMI', max_length=40, null=True)),
                ('dni', models.CharField(db_column='VDO_DNI', max_length=8)),
                ('tel', models.CharField(blank=True, db_column='VDO_TEL', max_length=15, null=True)),
                ('comivta', models.DecimalField(db_column='VDO_COMIVTA', decimal_places=2, max_digits=4)),
                ('liquivta', models.CharField(db_column='VDO_LIQUIVTA', max_length=1)),
                ('comicob', models.DecimalField(db_column='VDO_COMICOB', decimal_places=2, max_digits=4)),
                ('liquicob', models.CharField(db_column='VDO_LIQUICOB', max_length=1)),
                ('activo', models.CharField(db_column='VDO_ACTI', max_length=1)),
                ('localidad', models.ForeignKey(db_column='VDO_IDLOC', on_delete=django.db.models.deletion.PROTECT, to='clientes.localidad')),
            ],
            options={
                'db_table': 'VENDEDORES',
            },
        ),
        migrations.CreateModel(
            name='Cliente',
            fields=[
                ('id', models.AutoField(db_column='CLI_ID', primary_key=True, serialize=False)),
                ('codigo', models.IntegerField(db_column='CLI_CODIGO', unique=True)),
                ('razon', models.CharField(db_column='CLI_RAZON', max_length=50, unique=True)),
                ('fantasia', models.CharField(blank=True, db_column='CLI_FANTASIA', max_length=50, null=True)),
                ('domicilio', models.CharField(db_column='CLI_DOMI', max_length=40)),
                ('tel1', models.CharField(blank=True, db_column='CLI_TEL1', max_length=12, null=True)),
                ('tel2', models.CharField(blank=True, db_column='CLI_TEL2', max_length=12, null=True)),
                ('tel3', models.CharField(blank=True, db_column='CLI_TEL3', max_length=12, null=True)),
                ('email', models.CharField(blank=True, db_column='CLI_EMAIL', max_length=50, null=True)),
                ('cuit', models.CharField(blank=True, db_column='CLI_CUIT', max_length=11, null=True)),
                ('ib', models.CharField(blank=True, db_column='CLI_IB', max_length=10, null=True)),
                ('status', models.SmallIntegerField(blank=True, db_column='CLI_STATUS', null=True)),
                ('contacto', models.CharField(blank=True, db_column='CLI_CONTACTO', max_length=40, null=True)),
                ('comentario', models.CharField(blank=True, db_column='CLI_COMENTARIO', max_length=50, null=True)),
                ('lineacred', models.IntegerField(db_column='CLI_LINEACRED')),
                ('impsalcta', models.DecimalField(db_column='CLI_IMPSALCTA', decimal_places=2, max_digits=12)),
                ('fecsalcta', models.DateField(db_column='CLI_FECSALCTA')),
                ('descu1', models.DecimalField(blank=True, db_column='CLI_DESCU1', decimal_places=2, max_digits=4, null=True)),
                ('descu2', models.DecimalField(blank=True, db_column='CLI_DESCU2', decimal_places=2, max_digits=4, null=True)),
                ('descu3', models.DecimalField(blank=True, db_column='CLI_DESCU3', decimal_places=2, max_digits=4, null=True)),
                ('cpostal', models.CharField(blank=True, db_column='CLI_CPOSTAL', max_length=7, null=True)),
                ('zona', models.CharField(db_column='CLI_ZONA', max_length=10)),
                ('cancela', models.CharField(blank=True, db_column='CLI_CANCELA', max_length=1, null=True)),
                ('activo', models.CharField(blank=True, db_column='CLI_ACTI', max_length=1, null=True)),
                ('barrio', models.ForeignKey(blank=True, db_column='CLI_IDBAR', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.barrio')),
                ('categoria', models.ForeignKey(blank=True, db_column='CLI_IDCAC', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.categoriacliente')),
                ('localidad', models.ForeignKey(blank=True, db_column='CLI_IDLOC', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.localidad')),
                ('plazo', models.ForeignKey(blank=True, db_column='CLI_IDPLA', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.plazo')),
                ('provincia', models.ForeignKey(blank=True, db_column='CLI_IDPRV', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.provincia')),
                ('iva', models.ForeignKey(blank=True, db_column='CLI_IVA', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.tipoiva')),
                ('transporte', models.ForeignKey(blank=True, db_column='CLI_IDTRA', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.transporte')),
                ('vendedor', models.ForeignKey(blank=True, db_column='CLI_IDVDO', null=True, on_delete=django.db.models.deletion.PROTECT, to='clientes.vendedor')),
            ],
            options={
                'db_table': 'CLIENTES',
            },
        ),
    ]
