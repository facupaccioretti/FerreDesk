#!/usr/bin/env python
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from ferreapps.productos.models import Stock

def check_stock():
    print("=== Verificación de Productos Stock ===")
    
    # Contar todos los productos
    total_productos = Stock.objects.count()
    print(f"Total de productos: {total_productos}")
    
    # Contar productos activos
    productos_activos = Stock.objects.filter(acti='S').count()
    print(f"Productos activos (acti='S'): {productos_activos}")
    
    # Contar productos inactivos
    productos_inactivos = Stock.objects.filter(acti='N').count()
    print(f"Productos inactivos (acti='N'): {productos_inactivos}")
    
    # Contar productos sin estado
    productos_sin_estado = Stock.objects.filter(acti__isnull=True).count()
    print(f"Productos sin estado (acti=None): {productos_sin_estado}")
    
    # Mostrar algunos ejemplos
    print("\n=== Ejemplos de productos ===")
    productos_ejemplo = Stock.objects.all()[:5]
    for producto in productos_ejemplo:
        print(f"ID: {producto.id}, Denominación: {producto.deno}, Estado: {producto.acti}")
    
    # Verificar si hay productos activos
    if productos_activos > 0:
        print(f"\n✅ Hay {productos_activos} productos activos disponibles")
    else:
        print(f"\n❌ No hay productos activos. Esto explica por qué no se ven en el frontend.")
        
        # Mostrar todos los productos para debug
        print("\n=== Todos los productos ===")
        todos = Stock.objects.all()
        for producto in todos:
            print(f"ID: {producto.id}, Denominación: {producto.deno}, Estado: '{producto.acti}'")

if __name__ == "__main__":
    check_stock() 