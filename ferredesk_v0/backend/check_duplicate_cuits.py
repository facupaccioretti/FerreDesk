#!/usr/bin/env python
"""
Script para identificar CUITs duplicados en la tabla CLIENTES
Uso: python check_duplicate_cuits.py
"""

import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from ferreapps.clientes.models import Cliente

def encontrar_cuits_duplicados():
    """Encuentra todos los CUITs duplicados en la tabla CLIENTES"""
    
    print("🔍 Buscando CUITs duplicados en la tabla CLIENTES...")
    print("=" * 60)
    
    # Obtener todos los clientes con CUIT
    clientes_con_cuit = Cliente.objects.filter(cuit__isnull=False).exclude(cuit='')
    
    # Crear diccionario para contar ocurrencias
    cuits_count = {}
    cuits_clientes = {}
    
    for cliente in clientes_con_cuit:
        cuit = cliente.cuit.strip() if cliente.cuit else ''
        if cuit:
            if cuit not in cuits_count:
                cuits_count[cuit] = 0
                cuits_clientes[cuit] = []
            
            cuits_count[cuit] += 1
            cuits_clientes[cuit].append(cliente)
    
    # Encontrar duplicados
    duplicados = {cuit: count for cuit, count in cuits_count.items() if count > 1}
    
    if not duplicados:
        print("✅ No se encontraron CUITs duplicados!")
        print("Puedes proceder con la migración sin problemas.")
        return
    
    print(f"❌ Se encontraron {len(duplicados)} CUITs duplicados:")
    print("=" * 60)
    
    total_duplicados = 0
    for cuit, count in duplicados.items():
        print(f"\n📋 CUIT: {cuit} (aparece {count} veces)")
        print("-" * 40)
        
        for i, cliente in enumerate(cuits_clientes[cuit], 1):
            print(f"  {i}. ID: {cliente.id} | Código: {cliente.codigo} | Razón: {cliente.razon}")
            print(f"     Fantasía: {cliente.fantasia or 'N/A'}")
            print(f"     Domicilio: {cliente.domicilio}")
            print(f"     Activo: {cliente.activo}")
        
        total_duplicados += count - 1  # -1 porque uno es el original
    
    print("\n" + "=" * 60)
    print(f"📊 Resumen:")
    print(f"   - CUITs únicos duplicados: {len(duplicados)}")
    print(f"   - Registros duplicados totales: {total_duplicados}")
    print(f"   - Registros que necesitan atención: {total_duplicados}")
    
    print("\n💡 Opciones para resolver:")
    print("1. Eliminar registros duplicados (mantener solo uno por CUIT)")
    print("2. Actualizar CUITs duplicados a valores únicos")
    print("3. Revisar manualmente cada caso")
    print("4. Cancelar la migración")

def mostrar_estadisticas():
    """Muestra estadísticas generales de la tabla CLIENTES"""
    
    total_clientes = Cliente.objects.count()
    clientes_con_cuit = Cliente.objects.filter(cuit__isnull=False).exclude(cuit='').count()
    clientes_sin_cuit = total_clientes - clientes_con_cuit
    
    print("\n📈 Estadísticas de la tabla CLIENTES:")
    print(f"   - Total de clientes: {total_clientes}")
    print(f"   - Con CUIT: {clientes_con_cuit}")
    print(f"   - Sin CUIT: {clientes_sin_cuit}")

if __name__ == "__main__":
    try:
        mostrar_estadisticas()
        encontrar_cuits_duplicados()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1) 