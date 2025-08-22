from django.db import migrations

def cargar_alicuotas_iva(apps, schema_editor):
    """
    Carga las alícuotas de IVA estándar argentinas en la base de datos.
    """
    AlicuotaIVA = apps.get_model('productos', 'AlicuotaIVA')
    
    # Datos de alícuotas estándar argentinas
    alicuotas = [
        {
            'id': 1,
            'codigo': '1',
            'deno': 'NO GRAVADO',
            'porce': 0.00
        },
        {
            'id': 2,
            'codigo': '2',
            'deno': 'EXENTO',
            'porce': 0.00
        },
        {
            'id': 3,
            'codigo': '3',
            'deno': '0%',
            'porce': 0.00
        },
        {
            'id': 4,
            'codigo': '4',
            'deno': '10.5%',
            'porce': 10.50
        },
        {
            'id': 5,
            'codigo': '5',
            'deno': '21%',
            'porce': 21.00
        },
        {
            'id': 6,
            'codigo': '6',
            'deno': '27%',
            'porce': 27.00
        }
    ]
    
    # Crear cada alícuota si no existe
    for alicuota in alicuotas:
        AlicuotaIVA.objects.get_or_create(
            id=alicuota['id'],
            defaults={
                'codigo': alicuota['codigo'],
                'deno': alicuota['deno'],
                'porce': alicuota['porce']
            }
        )

def revertir_alicuotas_iva(apps, schema_editor):
    """
    Elimina las alícuotas de IVA cargadas por esta migración.
    """
    AlicuotaIVA = apps.get_model('productos', 'AlicuotaIVA')
    
    # Eliminar las alícuotas con IDs específicos
    AlicuotaIVA.objects.filter(id__in=[1, 2, 3, 4, 5, 6]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0002_vistas_productos'),
    ]

    operations = [
        migrations.RunPython(cargar_alicuotas_iva, revertir_alicuotas_iva),
    ]
