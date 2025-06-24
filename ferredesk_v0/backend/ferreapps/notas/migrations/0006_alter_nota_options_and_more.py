

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notas', '0005_alter_nota_options_nota_categoria_nota_estado_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='nota',
            options={'ordering': ['-ultimo_acceso']},
        ),
        migrations.RemoveIndex(
            model_name='nota',
            name='notas_nota_usuario_8f7d0c_idx',
        ),
        migrations.RemoveIndex(
            model_name='nota',
            name='notas_nota_usuario_ef69f0_idx',
        ),
        migrations.RemoveIndex(
            model_name='nota',
            name='notas_nota_usuario_b4a6c7_idx',
        ),
        migrations.RemoveIndex(
            model_name='nota',
            name='notas_nota_usuario_b8c866_idx',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='categoria',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='estado',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='etiquetas',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='metadata',
        ),
        migrations.RemoveField(
            model_name='nota',
            name='numero',
        ),
        migrations.AddField(
            model_name='nota',
            name='color',
            field=models.CharField(default='#FFEB3B', max_length=7),
        ),
        migrations.AddField(
            model_name='nota',
            name='emoji',
            field=models.CharField(default='📝', max_length=10),
        ),
    ]
