#!/usr/bin/env python3
"""
Script para probar consulta de padrón con configuración mínima
============================================================

Este script usa la configuración más simple posible para comparar
con arca_arg y identificar el problema.
"""

import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from zeep import Client
from zeep.transports import Transport
from requests import Session
import logging

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logging.getLogger('zeep').setLevel(logging.DEBUG)

def probar_configuracion_minima():
    """Prueba con configuración mínima como arca_arg"""
    print("=" * 80)
    print("PRUEBA CON CONFIGURACIÓN MÍNIMA")
    print("=" * 80)
    
    # Configuración mínima (como arca_arg)
    wsdl_url = "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5?wsdl"
    
    print(f"1. Creando cliente con configuración mínima...")
    print(f"   WSDL: {wsdl_url}")
    
    # Cliente con configuración mínima
    client_minimo = Client(wsdl_url)
    
    print(f"2. Cliente creado exitosamente")
    print(f"   Tipo: {type(client_minimo)}")
    print(f"   Servicios disponibles: {list(client_minimo.service.__dict__.keys())}")
    
    # Obtener datos de autenticación de FerreDesk
    print(f"\n3. Obteniendo datos de autenticación...")
    
    from ferreapps.ventas.ARCA.auth.FerreDeskAuth import FerreDeskAuth
    from ferreapps.productos.models import Ferreteria
    
    ferreteria = Ferreteria.objects.first()
    auth = FerreDeskAuth(ferreteria.id, ferreteria.modo_arca or 'HOM', 'ws_sr_constancia_inscripcion')
    auth_data = auth.get_auth_data()
    
    print(f"   Token: {auth_data['Token'][:20]}...")
    print(f"   Sign: {auth_data['Sign'][:20]}...")
    print(f"   Cuit: {auth_data['Cuit']}")
    
    # Probar con CUIT que falla
    cuit_prueba = "30718477448"
    
    print(f"\n4. Probando consulta con CUIT: {cuit_prueba}")
    
    # Payload idéntico a arca_arg
    data = {
        'token': auth_data['Token'],
        'sign': auth_data['Sign'],
        'cuitRepresentada': auth_data['Cuit'],
        'idPersona': int(cuit_prueba)
    }
    
    print(f"   Payload: {data}")
    
    try:
        # Llamada directa como arca_arg
        response = client_minimo.service.getPersona_v2(**data)
        print(f"✅ ÉXITO: {response}")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print(f"   Tipo de error: {type(e)}")
        
        # Análisis del error
        if "No existe persona con ese Id" in str(e):
            print(f"\n🔍 ANÁLISIS: AFIP dice que el CUIT no existe")
            print(f"   Esto sugiere que el problema NO está en la configuración del cliente")
            print(f"   El problema podría estar en:")
            print(f"   • El CUIT realmente no existe en AFIP")
            print(f"   • Diferencia en el formato de datos")
            print(f"   • Problema de autorización")
        
        elif "Computador no autorizado" in str(e):
            print(f"\n🔍 ANÁLISIS: Problema de autorización")
            print(f"   El certificado no está autorizado para este servicio")
        
        else:
            print(f"\n🔍 ANÁLISIS: Error diferente")
            print(f"   Comparar con el error de FerreDesk")

def probar_configuracion_ferredesk():
    """Prueba con la configuración actual de FerreDesk"""
    print("\n" + "=" * 80)
    print("PRUEBA CON CONFIGURACIÓN FERREDESK")
    print("=" * 80)
    
    from ferreapps.ventas.ARCA.services.WSConstanciaInscripcionService import WSConstanciaInscripcionService
    from ferreapps.productos.models import Ferreteria
    
    ferreteria = Ferreteria.objects.first()
    service = WSConstanciaInscripcionService(ferreteria.id, ferreteria.modo_arca or 'HOM')
    
    cuit_prueba = "30718477448"
    
    print(f"Probando con CUIT: {cuit_prueba}")
    
    try:
        response = service.get_persona_v2(cuit_prueba)
        print(f"✅ ÉXITO: {response}")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    probar_configuracion_minima()
    probar_configuracion_ferredesk()
