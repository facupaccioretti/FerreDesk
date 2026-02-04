"""Data migration para insertar métodos de pago iniciales.

Crea los métodos de pago predefinidos necesarios para el funcionamiento
del sistema de caja:
- Efectivo (afecta arqueo)
- Tarjeta Débito
- Tarjeta Crédito  
- Transferencia Bancaria
- Mercado Pago / QR
- Cuenta Corriente
- Cheque (para fase futura de Tesorería)
"""

from django.db import migrations


def crear_metodos_pago(apps, schema_editor):
    """Crea los métodos de pago iniciales."""
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    
    # Métodos de pago a crear
    # (codigo, nombre, descripcion, afecta_arqueo, orden)
    metodos = [
        ('efectivo', 'Efectivo', 
         'Pago en efectivo - Se cuenta en el arqueo de caja', True, 1),
        
        ('tarjeta_debito', 'Tarjeta Débito', 
         'Pago con tarjeta de débito', False, 2),
        
        ('tarjeta_credito', 'Tarjeta Crédito', 
         'Pago con tarjeta de crédito', False, 3),
        
        ('transferencia', 'Transferencia Bancaria', 
         'Transferencia a cuenta bancaria de la empresa', False, 4),
        
        ('qr', 'QR', 
         'Pago mediante QR o billetera virtual', False, 5),
        
        ('cuenta_corriente', 'Cuenta Corriente', 
         'Pago diferido a cuenta corriente del cliente', False, 6),
        
        ('cheque', 'Cheque', 
         'Pago con cheque de terceros', False, 7),
    ]
    
    for codigo, nombre, descripcion, afecta_arqueo, orden in metodos:
        MetodoPago.objects.get_or_create(
            codigo=codigo,
            defaults={
                'nombre': nombre,
                'descripcion': descripcion,
                'afecta_arqueo': afecta_arqueo,
                'activo': True,
                'orden': orden,
            }
        )


def borrar_metodos_pago(apps, schema_editor):
    """Reverso de la migración - borra los métodos creados."""
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    codigos = [
        'efectivo', 'tarjeta_debito', 'tarjeta_credito',
        'transferencia', 'qr', 'cuenta_corriente', 'cheque'
    ]
    MetodoPago.objects.filter(codigo__in=codigos).delete()


class Migration(migrations.Migration):
    """Migración de datos para métodos de pago iniciales."""
    
    dependencies = [
        ('caja', '0001_initial'),  # Depende de la migración que crea las tablas
    ]

    operations = [
        migrations.RunPython(crear_metodos_pago, borrar_metodos_pago),
    ]
