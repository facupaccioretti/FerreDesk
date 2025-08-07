#!/usr/bin/env python
"""
Diagnóstico de manejo de tokens AFIP - FerreDesk vs arca_arg
============================================================

Este script compara cómo maneja FerreDesk los tokens vs arca_arg
y verifica si el problema de "computador no autorizado" es por
tokens incorrectos.
"""

import os
import pickle
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verificar_comportamiento_arca_arg():
    """
    Explica cómo maneja arca_arg múltiples servicios.
    """
    print("=" * 80)
    print("COMPORTAMIENTO DE ARCA_ARG")
    print("=" * 80)
    
    print("✅ arca_arg SÍ pide tokens nuevos para cada servicio:")
    print()
    print("1. Cada servicio tiene su propio token:")
    print("   - wscpe.pkl (para Carta de Porte)")
    print("   - ws_sr_constancia_inscripcion.pkl (para Padrón)")
    print("   - wsfe.pkl (para Facturación)")
    print()
    print("2. Al inicializar ArcaWebService:")
    print("   arca_service = ArcaWebService(WSDL_CONSTANCIA_HOM, 'ws_sr_constancia_inscripcion')")
    print("   → Crea ArcaAuth('ws_sr_constancia_inscripcion')")
    print("   → Busca ws_sr_constancia_inscripcion.pkl")
    print("   → Si no existe, genera TRA con <service>ws_sr_constancia_inscripcion</service>")
    print()
    print("3. Cada servicio es independiente:")
    print("   - Token de wscpe NO sirve para ws_sr_constancia_inscripcion")
    print("   - Token de wsfe NO sirve para ws_sr_constancia_inscripcion")
    print("   - Cada uno requiere autorización específica en AFIP")

def verificar_tokens_ferredesk(ferreteria_id: int, modo: str = 'HOM'):
    """
    Verifica los tokens existentes en FerreDesk.
    """
    print("=" * 80)
    print("VERIFICACIÓN DE TOKENS FERREDESK")
    print("=" * 80)
    
    try:
        from ferreapps.ventas.ARCA.utils.ConfigManager import ConfigManager
        
        config = ConfigManager(ferreteria_id, modo)
        tokens_dir = config.paths['tokens_dir']
        
        print(f"Directorio de tokens: {tokens_dir}")
        
        if not os.path.exists(tokens_dir):
            print("❌ Directorio de tokens no existe")
            return []
        
        # Listar todos los tokens
        tokens_encontrados = []
        for file in os.listdir(tokens_dir):
            if file.endswith('.pkl'):
                file_path = os.path.join(tokens_dir, file)
                size = os.path.getsize(file_path)
                mtime = os.path.getmtime(file_path)
                mtime_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                
                service_name = file.replace('.pkl', '')
                tokens_encontrados.append({
                    'service': service_name,
                    'file': file,
                    'path': file_path,
                    'size': size,
                    'modified': mtime_str
                })
                
                print(f"📄 {file}")
                print(f"   Servicio: {service_name}")
                print(f"   Tamaño: {size} bytes")
                print(f"   Modificado: {mtime_str}")
                
                # Verificar si es el token correcto para padrón
                if service_name == 'ws_sr_constancia_inscripcion':
                    print(f"   ✅ Token CORRECTO para padrón")
                elif service_name in ['wsfe', 'wsfev1']:
                    print(f"   ❌ Token INCORRECTO - es para facturación")
                else:
                    print(f"   ⚠️  Token para servicio desconocido")
                
                print()
        
        if not tokens_encontrados:
            print("ℹ️  No se encontraron tokens")
        
        return tokens_encontrados
        
    except Exception as e:
        print(f"❌ Error verificando tokens: {e}")
        return []

def probar_autenticacion_especifica(ferreteria_id: int, modo: str = 'HOM'):
    """
    Prueba la autenticación específicamente para el padrón.
    """
    print("=" * 80)
    print("PRUEBA DE AUTENTICACIÓN ESPECÍFICA")
    print("=" * 80)
    
    try:
        from ferreapps.ventas.ARCA.services.WSConstanciaInscripcionService import WSConstanciaInscripcionService
        
        print("1. Inicializando servicio de constancia de inscripción...")
        service = WSConstanciaInscripcionService(ferreteria_id, modo)
        
        print("2. Verificando configuración de autenticación...")
        auth_service = service.auth.service
        print(f"   Servicio configurado: {auth_service}")
        
        if auth_service == 'ws_sr_constancia_inscripcion':
            print("   ✅ Servicio configurado correctamente")
        else:
            print(f"   ❌ Servicio configurado incorrectamente: {auth_service}")
            return False
        
        print("3. Probando método dummy...")
        try:
            response = service.dummy()
            print("   ✅ Dummy exitoso!")
            print(f"   Respuesta: {response}")
            return True
        except Exception as e:
            print(f"   ❌ Error en dummy: {e}")
            
            # Análisis específico del error
            error_str = str(e).lower()
            if "computador no autorizado" in error_str:
                print("\n🔍 DIAGNÓSTICO: Error de autorización")
                print("   Esto indica que el token fue generado para otro servicio.")
                print("   Posibles causas:")
                print("   1. Token existente de wsfev1/wsfe")
                print("   2. Certificado no autorizado para ws_sr_constancia_inscripcion")
                print("   3. Token expirado o corrupto")
            elif "certificado" in error_str:
                print("\n🔍 DIAGNÓSTICO: Error de certificado")
                print("   Problema con el certificado o clave privada")
            else:
                print(f"\n🔍 DIAGNÓSTICO: Error desconocido")
                print(f"   Tipo de error: {type(e).__name__}")
            
            return False
            
    except Exception as e:
        print(f"❌ Error inicializando servicio: {e}")
        return False

def limpiar_tokens_incorrectos(ferreteria_id: int, modo: str = 'HOM'):
    """
    Limpia tokens que pueden estar causando conflictos.
    """
    print("=" * 80)
    print("LIMPIEZA DE TOKENS INCORRECTOS")
    print("=" * 80)
    
    try:
        from ferreapps.ventas.ARCA.utils.ConfigManager import ConfigManager
        
        config = ConfigManager(ferreteria_id, modo)
        tokens_dir = config.paths['tokens_dir']
        
        # Tokens que pueden causar conflictos
        servicios_problematicos = ['wsfe', 'wsfev1', 'ws_sr_constancia_inscripcion']
        
        for service in servicios_problematicos:
            token_path = config.get_token_path(service)
            
            if os.path.exists(token_path):
                try:
                    os.remove(token_path)
                    print(f"🗑️  Token eliminado: {service}.pkl")
                except Exception as e:
                    print(f"❌ Error eliminando token {service}: {e}")
            else:
                print(f"ℹ️  Token no existe: {service}.pkl")
        
        print("✅ Limpieza completada")
        print("🔄 Ahora se generarán tokens nuevos específicos para cada servicio")
        
    except Exception as e:
        print(f"❌ Error en limpieza: {e}")

def main():
    """
    Función principal del diagnóstico.
    """
    print("🔧 DIAGNÓSTICO DE TOKENS AFIP - FERREDESK vs ARCA_ARG")
    print("Este script verifica si el problema es por tokens incorrectos")
    print()
    
    # Configuración
    ferreteria_id = 1  # Cambiar según tu configuración
    modo = 'HOM'       # Cambiar a 'PROD' si es necesario
    
    print(f"Configuración:")
    print(f"  Ferretería ID: {ferreteria_id}")
    print(f"  Modo: {modo}")
    print()
    
    # 1. Explicar comportamiento de arca_arg
    verificar_comportamiento_arca_arg()
    
    print()
    
    # 2. Verificar tokens existentes en FerreDesk
    tokens = verificar_tokens_ferredesk(ferreteria_id, modo)
    
    print()
    
    # 3. Probar autenticación
    print("Probando autenticación específica para padrón...")
    exito = probar_autenticacion_especifica(ferreteria_id, modo)
    
    print()
    
    # 4. Recomendaciones
    if not exito:
        print("❌ Problemas de autenticación detectados.")
        print("\n📋 RECOMENDACIONES:")
        print("1. Limpiar tokens existentes para forzar regeneración")
        print("2. Verificar que el certificado esté autorizado para ws_sr_constancia_inscripcion")
        print("3. Ejecutar: python manage.py diagnosticar_padron_afip")
        
        respuesta = input("\n¿Quieres limpiar tokens existentes? (s/n): ").lower().strip()
        if respuesta in ['s', 'si', 'sí', 'y', 'yes']:
            limpiar_tokens_incorrectos(ferreteria_id, modo)
            print("\n🔄 Ahora prueba nuevamente la autenticación")
        else:
            print("⏭️  Saltando limpieza de tokens")
    else:
        print("✅ ¡Autenticación exitosa! El sistema está funcionando correctamente.")

if __name__ == "__main__":
    main()
