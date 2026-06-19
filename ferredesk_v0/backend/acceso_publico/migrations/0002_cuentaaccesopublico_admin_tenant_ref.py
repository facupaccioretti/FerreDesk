from django.db import migrations, models


def poblar_referencias_admin_tenant(apps, schema_editor):
    CuentaAccesoPublico = apps.get_model("acceso_publico", "CuentaAccesoPublico")

    for cuenta in CuentaAccesoPublico.objects.filter(username_tenant="", email_tenant=""):
        cuenta.username_tenant = cuenta.email
        cuenta.email_tenant = cuenta.email
        cuenta.save(update_fields=["username_tenant", "email_tenant"])


class Migration(migrations.Migration):

    dependencies = [
        ("acceso_publico", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="cuentaaccesopublico",
            name="email_tenant",
            field=models.EmailField(blank=True, default="", max_length=254),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="cuentaaccesopublico",
            name="username_tenant",
            field=models.CharField(blank=True, default="", max_length=150),
            preserve_default=False,
        ),
        migrations.RunPython(
            poblar_referencias_admin_tenant,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="cuentaaccesopublico",
            name="email_tenant",
            field=models.EmailField(max_length=254),
        ),
        migrations.AlterField(
            model_name="cuentaaccesopublico",
            name="username_tenant",
            field=models.CharField(max_length=150),
        ),
    ]
