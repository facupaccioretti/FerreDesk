# Generated by Django 5.0.1 on 2025-05-12 00:34

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0002_cliusuario'),
    ]

    operations = [
        migrations.CreateModel(
            name='Barrio',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
            ],
            options={
                'verbose_name': 'Barrio',
                'verbose_name_plural': 'Barrios',
            },
        ),
        migrations.CreateModel(
            name='Localidad',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('codigo_postal', models.CharField(max_length=10)),
            ],
            options={
                'verbose_name': 'Localidad',
                'verbose_name_plural': 'Localidades',
            },
        ),
        migrations.CreateModel(
            name='Cliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('apellido', models.CharField(max_length=100)),
                ('documento', models.CharField(max_length=20, unique=True)),
                ('telefono', models.CharField(max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('direccion', models.CharField(max_length=200)),
                ('fecha_registro', models.DateTimeField(auto_now_add=True)),
                ('ultima_actualizacion', models.DateTimeField(auto_now=True)),
                ('activo', models.BooleanField(default=True)),
                ('notas', models.TextField(blank=True, null=True)),
                ('barrio', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='usuarios.barrio')),
                ('localidad', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='usuarios.localidad')),
            ],
            options={
                'verbose_name': 'Cliente',
                'verbose_name_plural': 'Clientes',
                'ordering': ['-fecha_registro'],
            },
        ),
        migrations.AddField(
            model_name='barrio',
            name='localidad',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='barrios', to='usuarios.localidad'),
        ),
        migrations.AlterUniqueTogether(
            name='barrio',
            unique_together={('nombre', 'localidad')},
        ),
    ]
