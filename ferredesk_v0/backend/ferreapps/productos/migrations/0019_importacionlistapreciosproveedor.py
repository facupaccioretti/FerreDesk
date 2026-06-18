from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import ferreapps.productos.utils.file_paths


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("productos", "0018_stockprove_proveedor_codigo_idx"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportacionListaPreciosProveedor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("procesando", "Procesando"),
                            ("completada", "Completada"),
                            ("error", "Error"),
                        ],
                        db_index=True,
                        default="pendiente",
                        max_length=16,
                    ),
                ),
                ("nombre_archivo", models.CharField(max_length=255)),
                (
                    "archivo_temporal",
                    models.FileField(
                        upload_to=ferreapps.productos.utils.file_paths.upload_importacion_lista_precios_temporal
                    ),
                ),
                ("col_codigo", models.CharField(default="A", max_length=4)),
                ("col_precio", models.CharField(default="B", max_length=4)),
                ("col_denominacion", models.CharField(default="C", max_length=4)),
                ("fila_inicio", models.PositiveIntegerField(default=2)),
                ("registros_procesados", models.PositiveIntegerField(default=0)),
                ("registros_actualizados", models.PositiveIntegerField(default=0)),
                ("mensaje_error", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("iniciado_en", models.DateTimeField(blank=True, null=True)),
                ("finalizado_en", models.DateTimeField(blank=True, null=True)),
                (
                    "proveedor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="importaciones_listas_precios",
                        to="productos.proveedor",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="importaciones_listas_precios_proveedor",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Importacion de lista de precios de proveedor",
                "verbose_name_plural": "Importaciones de listas de precios de proveedor",
                "ordering": ("-creado_en",),
            },
        ),
    ]
