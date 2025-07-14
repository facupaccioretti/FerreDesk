#!/usr/bin/env python
"""
Script de prueba para verificar la restricción de eliminación de clientes.
Este script debe ejecutarse después de aplicar las migraciones.

Uso:
    python test_restriccion_clientes.py
"""

import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from django.db import transaction
from django.db.models import ProtectedError
from ferreapps.clientes.models import Cliente
from ferreapps.ventas.models import Venta, Comprobante
from datetime import date

def test_restriccion_eliminacion():
    """
    Prueba la restricción de eliminación de clientes con movimientos comerciales.
    """
    print("🧪 Iniciando pruebas de restricción de eliminación de clientes...")
    print("=" * 60)
    
    # Buscar un cliente que tenga ventas
    cliente_con_ventas = None
    cliente_sin_ventas = None
    
    try:
        # Buscar cliente con ventas
        ventas_con_clientes = Venta.objects.select_related('ven_idcli').distinct('ven_idcli')
        if ventas_con_clientes.exists():
            cliente_con_ventas = ventas_con_clientes.first().ven_idcli
            print(f"✅ Cliente con ventas encontrado: {cliente_con_ventas.razon} (ID: {cliente_con_ventas.id})")
        else:
            print("⚠️  No se encontraron clientes con ventas. Creando datos de prueba...")
            # Crear datos de prueba si no existen
            cliente_con_ventas = crear_datos_prueba()
        
        # Buscar cliente sin ventas
        clientes_sin_ventas = Cliente.objects.exclude(
            id__in=Venta.objects.values_list('ven_idcli', flat=True)
        ).exclude(id=1)  # Excluir cliente por defecto
        
        if clientes_sin_ventas.exists():
            cliente_sin_ventas = clientes_sin_ventas.first()
            print(f"✅ Cliente sin ventas encontrado: {cliente_sin_ventas.razon} (ID: {cliente_sin_ventas.id})")
        else:
            print("⚠️  No se encontraron clientes sin ventas.")
            return
        
        # Prueba 1: Intentar eliminar cliente CON ventas (debe fallar)
        print("\n🔒 Prueba 1: Intentando eliminar cliente CON movimientos comerciales...")
        try:
            with transaction.atomic():
                cliente_con_ventas.delete()
            print("❌ ERROR: Se eliminó un cliente con ventas (no debería haber pasado)")
            return False
        except ProtectedError as e:
            print("✅ CORRECTO: Se bloqueó la eliminación del cliente con ventas")
            print(f"   Error: {e}")
        
        # Prueba 2: Intentar eliminar cliente SIN ventas (debe funcionar)
        print("\n✅ Prueba 2: Intentando eliminar cliente SIN movimientos comerciales...")
        try:
            cliente_nombre = cliente_sin_ventas.razon
            cliente_sin_ventas.delete()
            print(f"✅ CORRECTO: Se eliminó el cliente '{cliente_nombre}' sin ventas")
        except Exception as e:
            print(f"❌ ERROR: No se pudo eliminar el cliente sin ventas: {e}")
            return False
        
        print("\n🎉 ¡Todas las pruebas pasaron exitosamente!")
        print("=" * 60)
        print("✅ La restricción de eliminación está funcionando correctamente")
        print("✅ Los clientes con movimientos comerciales están protegidos")
        print("✅ Los clientes sin movimientos pueden ser eliminados")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante las pruebas: {e}")
        return False

def crear_datos_prueba():
    """
    Crea datos de prueba si no existen clientes con ventas.
    """
    print("📝 Creando datos de prueba...")
    
    # Crear un comprobante de prueba
    comprobante, created = Comprobante.objects.get_or_create(
        codigo_afip='001',
        defaults={
            'nombre': 'Factura A',
            'descripcion': 'Factura A de prueba',
            'letra': 'A',
            'tipo': 'factura',
            'activo': True
        }
    )
    
    # Crear un cliente de prueba
    cliente = Cliente.objects.create(
        codigo=999999,
        razon='Cliente de Prueba con Ventas',
        fantasia='Cliente Prueba',
        domicilio='Dirección de Prueba',
        lineacred=10000,
        impsalcta=0.00,
        fecsalcta=date.today(),
        zona='ZONA1',
        activo='A'
    )
    
    # Crear una venta de prueba
    venta = Venta.objects.create(
        ven_sucursal=1,
        ven_fecha=date.today(),
        comprobante=comprobante,
        ven_punto=1,
        ven_numero=1,
        ven_descu1=0.00,
        ven_descu2=0.00,
        ven_descu3=0.00,
        ven_vdocomvta=0.00,
        ven_vdocomcob=0.00,
        ven_idcli=cliente,
        ven_idpla=1,
        ven_idvdo=1,
        ven_copia=1
    )
    
    print(f"✅ Datos de prueba creados: Cliente '{cliente.razon}' con venta")
    return cliente

def verificar_estructura_bd():
    """
    Verifica que la estructura de la base de datos sea correcta.
    """
    print("🔍 Verificando estructura de la base de datos...")
    
    try:
        # Verificar que el campo ven_idcli sea ForeignKey
        campo_ven_idcli = Venta._meta.get_field('ven_idcli')
        if hasattr(campo_ven_idcli, 'related_model'):
            print("✅ Campo ven_idcli es ForeignKey correctamente")
            print(f"   Modelo relacionado: {campo_ven_idcli.related_model}")
            print(f"   on_delete: {campo_ven_idcli.remote_field.on_delete}")
        else:
            print("❌ ERROR: Campo ven_idcli no es ForeignKey")
            return False
        
        # Verificar que on_delete sea PROTECT
        if campo_ven_idcli.remote_field.on_delete.__name__ == 'PROTECT':
            print("✅ on_delete está configurado como PROTECT")
        else:
            print(f"❌ ERROR: on_delete es {campo_ven_idcli.remote_field.on_delete}, debería ser PROTECT")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error verificando estructura: {e}")
        return False

if __name__ == '__main__':
    print("🚀 Iniciando verificación de restricción de eliminación de clientes")
    print("=" * 60)
    
    # Verificar estructura de BD
    if not verificar_estructura_bd():
        print("\n❌ La estructura de la base de datos no es correcta")
        print("   Asegúrate de haber aplicado las migraciones:")
        print("   python manage.py makemigrations ventas")
        print("   python manage.py migrate")
        sys.exit(1)
    
    # Ejecutar pruebas
    if test_restriccion_eliminacion():
        print("\n🎯 Implementación exitosa!")
        sys.exit(0)
    else:
        print("\n💥 Las pruebas fallaron")
        sys.exit(1) 