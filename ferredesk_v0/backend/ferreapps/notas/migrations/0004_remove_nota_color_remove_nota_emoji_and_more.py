# Generated by Django 5.1.7 on 2025-05-26 15:20

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notas', '0003_alter_nota_usuario'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(
            model_name='nota',
            name='color',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='emoji',
        ),
        migrations.AlterField(
            model_name='nota',
            name='usuario',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
    ]
