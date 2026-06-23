from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("caja", "0017_add_fondos_propios"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="movimientocaja",
            index=models.Index(
                fields=["sesion_caja", "tipo"],
                name="caja_mov_sesion_tipo_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="pagoventa",
            index=models.Index(
                fields=["cuenta_banco", "es_vuelto"],
                name="caja_pag_cuenta_vuelto_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="cheque",
            index=models.Index(
                fields=["estado", "cuenta_banco_deposito"],
                name="caja_che_estado_cuenta_idx",
            ),
        ),
    ]
