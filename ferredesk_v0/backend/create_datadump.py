#!/usr/bin/env python
"""
Script personalizado para crear datadump de la base de datos
Maneja codificación Unicode correctamente en Windows
"""

import os
import sys
import django
import json
from django.core.management import call_command
from django.core.serializers import serialize
from django.apps import apps

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

def crear_datadump_seguro():
    """Crea un datadump seguro manejando codificación Unicode"""
    
    print("🔄 Creando datadump de la base de datos...")
    
    # Lista de apps para exportar
    apps_to_export = [
        'clientes',
        'productos', 
        'ventas',
        'usuarios',
        'notas',
        'alertas',
        'reservas',
        'proveedores',
        'informes'
    ]
    
    all_data = []
    
    for app_name in apps_to_export:
        try:
            print(f"📦 Exportando {app_name}...")
            
            # Obtener todos los modelos de la app
            app_config = apps.get_app_config(app_name)
            models = app_config.get_models()
            
            for model in models:
                try:
                    # Serializar cada modelo
                    data = serialize('json', model.objects.all(), ensure_ascii=False)
                    parsed_data = json.loads(data)
                    all_data.extend(parsed_data)
                    
                    count = model.objects.count()
                    print(f"  ✅ {model.__name__}: {count} registros")
                    
                except Exception as e:
                    print(f"  ⚠️ Error en {model.__name__}: {e}")
                    continue
                    
        except Exception as e:
            print(f"⚠️ Error exportando {app_name}: {e}")
            continue
    
    # Guardar en archivo con codificación UTF-8
    output_file = 'datadump_completo_seguro.json'
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Datadump creado exitosamente: {output_file}")
        print(f"📊 Total de registros exportados: {len(all_data)}")
        
    except Exception as e:
        print(f"❌ Error guardando archivo: {e}")
        return False
    
    return True

def verificar_datadump():
    """Verifica que el datadump se puede cargar correctamente"""
    
    print("\n🔍 Verificando datadump...")
    
    try:
        with open('datadump_completo_seguro.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"✅ Datadump válido: {len(data)} registros")
        
        # Contar por modelo
        models_count = {}
        for item in data:
            model_name = item['model']
            if model_name not in models_count:
                models_count[model_name] = 0
            models_count[model_name] += 1
        
        print("\n📊 Resumen por modelo:")
        for model, count in sorted(models_count.items()):
            print(f"  {model}: {count} registros")
            
        return True
        
    except Exception as e:
        print(f"❌ Error verificando datadump: {e}")
        return False

if __name__ == "__main__":
    try:
        success = crear_datadump_seguro()
        if success:
            verificar_datadump()
        else:
            print("❌ Falló la creación del datadump")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error general: {e}")
        sys.exit(1) 