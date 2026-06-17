from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0002_alter_empresatenant_estado_suscripcion_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SolicitudOnboardingTenant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=200)),
                ("slug", models.SlugField(max_length=63)),
                ("email_admin", models.EmailField(max_length=254)),
                ("estado", models.CharField(choices=[("pendiente", "Pendiente"), ("en_proceso", "En proceso"), ("completado", "Completado"), ("error", "Error")], default="pendiente", max_length=32)),
                ("error_codigo", models.CharField(blank=True, max_length=64)),
                ("error_detalle", models.TextField(blank=True)),
                ("payload_resumen", models.JSONField(blank=True, default=dict)),
                ("intentos", models.PositiveIntegerField(default=0)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("tenant", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="solicitudes_onboarding", to="tenants.empresatenant")),
            ],
            options={
                "verbose_name": "Solicitud de onboarding SaaS",
                "verbose_name_plural": "Solicitudes de onboarding SaaS",
                "ordering": ("-creado_en",),
            },
        ),
    ]
