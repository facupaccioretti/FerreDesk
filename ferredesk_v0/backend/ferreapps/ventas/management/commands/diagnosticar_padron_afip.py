"""
Comando para diagnosticar problemas con el servicio de padrón de AFIP
====================================================================

Este comando ayuda a identificar problemas de configuración y autorización
con el servicio ws_sr_padron_a5 de AFIP.
"""

from django.core.management.base import BaseCommand
import logging
import os

from ferreapps.ventas.ARCA import FerreDeskARCA
from ferreapps.productos.models import Ferreteria

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Diagnostica problemas con el servicio de padrón de AFIP'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detallado',
            action='store_true',
            help='Mostrar información detallada de la configuración'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('DIAGNÓSTICO DEL SERVICIO DE PADRÓN AFIP')
        )
        self.stdout.write('=' * 80)
        
        try:
            # Obtener ferretería
            ferreteria = Ferreteria.objects.first()
            if not ferreteria:
                self.stdout.write(
                    self.style.ERROR('No se encontró ferretería configurada')
                )
                return
            
            # Verificar configuración básica
            self._verificar_configuracion_basica(ferreteria)
            
            # Verificar archivos de certificados
            self._verificar_certificados(ferreteria)
            
            # Verificar configuración ARCA
            self._verificar_configuracion_arca(ferreteria)
            
            # Verificar servicio de padrón
            self._verificar_servicio_padron(ferreteria)
            
            # Información adicional si se solicita
            if options['detallado']:
                self._mostrar_informacion_detallada(ferreteria)
            
            # Mostrar recomendaciones
            self._mostrar_recomendaciones()
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error en diagnóstico: {e}')
            )
            logger.error(f"Error en diagnóstico: {e}")

    def _verificar_configuracion_basica(self, ferreteria):
        """Verifica la configuración básica de la ferretería"""
        self.stdout.write('1. CONFIGURACIÓN BÁSICA DE FERRETERÍA:')
        self.stdout.write('-' * 50)
        
        # CUIT
        cuit = ferreteria.cuit_cuil
        self.stdout.write(f"• CUIT: {cuit or 'NO CONFIGURADO'}")
        
        # Modo
        modo = ferreteria.modo_arca
        self.stdout.write(f"• Modo: {modo or 'NO CONFIGURADO'}")
        
        # Certificado
        certificado = ferreteria.certificado_arca
        self.stdout.write(f"• Certificado: {certificado or 'NO CONFIGURADO'}")
        
        # Clave privada
        clave_privada = ferreteria.clave_privada_arca
        self.stdout.write(f"• Clave privada: {clave_privada or 'NO CONFIGURADO'}")
        
        # Punto de venta
        punto_venta = ferreteria.punto_venta_arca
        self.stdout.write(f"• Punto de venta: {punto_venta or 'NO CONFIGURADO'}")
        
        # Razón social
        razon_social = ferreteria.razon_social
        self.stdout.write(f"• Razón social: {razon_social or 'NO CONFIGURADO'}")
        
        # ARCA habilitado
        arca_habilitado = ferreteria.arca_habilitado
        self.stdout.write(f"• ARCA habilitado: {'SÍ' if arca_habilitado else 'NO'}")
        
        # ARCA configurado
        arca_configurado = ferreteria.arca_configurado
        self.stdout.write(f"• ARCA configurado: {'SÍ' if arca_configurado else 'NO'}")
        
        self.stdout.write('')

    def _verificar_certificados(self, ferreteria):
        """Verifica que los archivos de certificados existan"""
        self.stdout.write('2. VERIFICACIÓN DE ARCHIVOS DE CERTIFICADOS:')
        self.stdout.write('-' * 50)
        
        certificado = ferreteria.certificado_arca
        clave_privada = ferreteria.clave_privada_arca
        
        if certificado:
            try:
                # Para archivos de Django, usar .path para obtener la ruta real
                certificado_path = certificado.path
                if os.path.exists(certificado_path):
                    self.stdout.write(
                        self.style.SUCCESS(f"Certificado existe: {certificado_path}")
                    )
                    # Verificar tamaño
                    size = os.path.getsize(certificado_path)
                    self.stdout.write(f"  Tamaño: {size} bytes")
                else:
                    self.stdout.write(
                        self.style.ERROR(f"Certificado NO existe: {certificado_path}")
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Error verificando certificado: {e}")
                )
        else:
            self.stdout.write(
                self.style.ERROR("Certificado no configurado")
            )
        
        if clave_privada:
            try:
                # Para archivos de Django, usar .path para obtener la ruta real
                clave_privada_path = clave_privada.path
                if os.path.exists(clave_privada_path):
                    self.stdout.write(
                        self.style.SUCCESS(f"Clave privada existe: {clave_privada_path}")
                    )
                    # Verificar tamaño
                    size = os.path.getsize(clave_privada_path)
                    self.stdout.write(f"  Tamaño: {size} bytes")
                else:
                    self.stdout.write(
                        self.style.ERROR(f"Clave privada NO existe: {clave_privada_path}")
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Error verificando clave privada: {e}")
                )
        else:
            self.stdout.write(
                self.style.ERROR("Clave privada no configurada")
            )
        
        self.stdout.write('')

    def _verificar_configuracion_arca(self, ferreteria):
        """Verifica la configuración ARCA"""
        self.stdout.write('3. CONFIGURACIÓN ARCA:')
        self.stdout.write('-' * 50)
        
        try:
            from ferreapps.ventas.ARCA.utils.ConfigManager import ConfigManager
            
            config = ConfigManager(ferreteria.id, ferreteria.modo_arca or 'HOM')
            
            # URLs
            urls = config.urls
            self.stdout.write("• URLs configuradas:")
            for service, url in urls.items():
                self.stdout.write(f"  - {service}: {url}")
            
            # Paths
            paths = config.paths
            self.stdout.write("• Paths configurados:")
            for key, path in paths.items():
                self.stdout.write(f"  - {key}: {path}")
            
            # Verificar directorio de tokens
            tokens_dir = paths.get('tokens_dir')
            if tokens_dir:
                if os.path.exists(tokens_dir):
                    self.stdout.write(
                        self.style.SUCCESS(f"Directorio de tokens existe: {tokens_dir}")
                    )
                    # Listar tokens existentes
                    tokens = [f for f in os.listdir(tokens_dir) if f.endswith('.pkl')]
                    if tokens:
                        self.stdout.write(f"  Tokens encontrados: {', '.join(tokens)}")
                    else:
                        self.stdout.write("  No hay tokens guardados")
                else:
                    self.stdout.write(
                        self.style.WARNING(f"Directorio de tokens NO existe: {tokens_dir}")
                    )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error verificando configuración ARCA: {e}")
            )
        
        self.stdout.write('')

    def _verificar_servicio_padron(self, ferreteria):
        """Verifica el servicio de padrón específicamente"""
        self.stdout.write('4. VERIFICACIÓN DEL SERVICIO DE PADRÓN:')
        self.stdout.write('-' * 50)
        
        try:
            arca = FerreDeskARCA(ferreteria)
            
            # Validar servicio
            self.stdout.write("Validando servicio de padrón...")
            resultado = arca.validar_servicio_padron()
            
            if resultado['status'] == 'success':
                self.stdout.write(
                    self.style.SUCCESS(f"{resultado['message']}")
                )
                self.stdout.write(f"  Métodos disponibles: {', '.join(resultado['available_methods'])}")
            else:
                self.stdout.write(
                    self.style.WARNING(f"{resultado['message']}")
                )
            
            # Intentar autenticación
            self.stdout.write(" Probando autenticación...")
            try:
                from ferreapps.ventas.ARCA.auth.FerreDeskAuth import FerreDeskAuth
                auth = FerreDeskAuth(ferreteria.id, ferreteria.modo_arca or 'HOM', 'ws_sr_constancia_inscripcion')
                auth_data = auth.get_auth_data()
                self.stdout.write(
                    self.style.SUCCESS("Autenticación exitosa")
                )
                self.stdout.write(f"  Token: {auth_data['Token'][:20]}...")
                self.stdout.write(f"  Sign: {auth_data['Sign'][:20]}...")
                self.stdout.write(f"  Cuit: {auth_data['Cuit']}")
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Error en autenticación: {e}")
                )
                
                # Análisis del error
                if "Computador no autorizado" in str(e):
                    self.stdout.write("")
                    self.stdout.write(
                        self.style.WARNING("ANÁLISIS DEL ERROR:")
                    )
                    self.stdout.write(" El certificado no está autorizado para el servicio ws_sr_constancia_inscripcion")
                    self.stdout.write(" Necesitas solicitar autorización específica en AFIP")
                    self.stdout.write(" Ve a https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp")
                    self.stdout.write(" Solicita acceso al servicio 'ws_sr_constancia_inscripcion'")
                    self.stdout.write(" El certificado actual solo está autorizado para 'wsfev1'")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f" Error verificando servicio: {e}")
            )
        
        self.stdout.write('')

    def _mostrar_informacion_detallada(self, ferreteria):
        """Muestra información detallada de la configuración"""
        self.stdout.write('5. INFORMACIÓN DETALLADA:')
        self.stdout.write('-' * 50)
        
        # Información del modelo Ferreteria
        self.stdout.write(" Campos del modelo Ferreteria:")
        for field in ferreteria._meta.fields:
            if 'arca' in field.name.lower():
                value = getattr(ferreteria, field.name)
                self.stdout.write(f"  - {field.name}: {value}")
        
        # Verificar si hay tokens existentes
        try:
            from ferreapps.ventas.ARCA.utils.ConfigManager import ConfigManager
            config = ConfigManager(ferreteria.id, ferreteria.modo_arca or 'HOM')
            tokens_dir = config.paths.get('tokens_dir')
            
            if tokens_dir and os.path.exists(tokens_dir):
                self.stdout.write(" Tokens existentes:")
                for file in os.listdir(tokens_dir):
                    if file.endswith('.pkl'):
                        file_path = os.path.join(tokens_dir, file)
                        size = os.path.getsize(file_path)
                        mtime = os.path.getmtime(file_path)
                        from datetime import datetime
                        mtime_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                        self.stdout.write(f"  - {file}: {size} bytes, modificado: {mtime_str}")
        
        except Exception as e:
            self.stdout.write(f"  Error obteniendo información detallada: {e}")
        
        self.stdout.write('')

    def _mostrar_recomendaciones(self):
        """Muestra recomendaciones para solucionar problemas"""
        self.stdout.write('6. RECOMENDACIONES:')
        self.stdout.write('-' * 50)
        
        self.stdout.write(" Si el error es 'Computador no autorizado':")
        self.stdout.write("  1. Ve a https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp")
        self.stdout.write("  2. Inicia sesión con tu CUIT")
        self.stdout.write("  3. Ve a 'Solicitud de Certificado'")
        self.stdout.write("  4. Solicita acceso al servicio 'ws_sr_padron_a5'")
        self.stdout.write("  5. Descarga el nuevo certificado")
        self.stdout.write("  6. Actualiza la configuración en FerreDesk")
        
        self.stdout.write("")
        self.stdout.write("• Si el certificado no existe:")
        self.stdout.write("  1. Verifica que los archivos estén en la ubicación correcta")
        self.stdout.write("  2. Verifica permisos de lectura")
        self.stdout.write("  3. Asegúrate de que los nombres de archivo coincidan")
        
        self.stdout.write("")
        self.stdout.write(" Para verificar que wsfev1 sigue funcionando:")
        self.stdout.write("  python manage.py probar_arca") 