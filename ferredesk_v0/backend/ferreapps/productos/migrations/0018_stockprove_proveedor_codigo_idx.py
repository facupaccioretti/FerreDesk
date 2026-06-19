from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("productos", "0017_alter_ferreteria_logo_empresa"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="stockprove",
            index=models.Index(
                fields=["proveedor", "codigo_producto_proveedor"],
                name="STOCKPROVE_STP_IDP_429e41_idx",
            ),
        ),
    ]
