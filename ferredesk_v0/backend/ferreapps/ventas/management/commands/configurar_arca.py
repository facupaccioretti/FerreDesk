from django.core.management.base import BaseCommand, CommandError
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.ARCA import validar_configuracion_arca, probar_conectividad_arca

class Command(BaseCommand):
    help = 'Configura ARCA internamente (habilitación y modo) usando la nueva arquitectura modular'

    def add_arguments(self, parser):
        parser.add_argument(
            '--habilitar',
            action='store_true',
            help='Habilitar ARCA',
        )
        parser.add_argument(
            '--deshabilitar',
            action='store_true',
            help='Deshabilitar ARCA',
        )
        parser.add_argument(
            '--modo',
            choices=['HOM', 'PROD'],
            help='Modo de ARCA: HOM (Homologación) o PROD (Producción)',
        )
        parser.add_argument(
            '--mostrar',
            action='store_true',
            help='Mostrar configuración actual de ARCA',
        )
        parser.add_argument(
            '--validar',
            action='store_true',
            help='Validar configuración usando la nueva arquitectura',
        )
        parser.add_argument(
            '--probar-conectividad',
            action='store_true',
            help='Probar conectividad con AFIP usando la nueva arquitectura',
        )

    def handle(self, *args, **options):
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            self.stdout.write(
                self.style.ERROR('No existe ferretería configurada. Ejecute primero: python manage.py configurar_ferreteria')
            )
            return

        # Mostrar configuración actual
        if options['mostrar']:
            self.mostrar_configuracion(ferreteria)
            return

        # Validar configuración usando nueva arquitectura
        if options['validar']:
            self.validar_configuracion(ferreteria)
            return

        # Probar conectividad usando nueva arquitectura
        if options['probar_conectividad']:
            self.probar_conectividad(ferreteria)
            return

        # Cambiar habilitación
        if options['habilitar']:
            ferreteria.arca_habilitado = True
            self.stdout.write(
                self.style.SUCCESS('ARCA habilitado correctamente')
            )

        if options['deshabilitar']:
            ferreteria.arca_habilitado = False
            self.stdout.write(
                self.style.SUCCESS('ARCA deshabilitado correctamente')
            )

        # Cambiar modo
        if options['modo']:
            ferreteria.modo_arca = options['modo']
            modo_texto = 'Producción' if options['modo'] == 'PROD' else 'Homologación'
            self.stdout.write(
                self.style.SUCCESS(f'Modo ARCA cambiado a: {modo_texto}')
            )

        # Guardar cambios
        if options['habilitar'] or options['deshabilitar'] or options['modo']:
            ferreteria.save()
            self.mostrar_configuracion(ferreteria)

    def mostrar_configuracion(self, ferreteria):
        """Muestra la configuración actual de ARCA"""
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('CONFIGURACIÓN ARCA ACTUAL'))
        self.stdout.write('='*50)
        
        estado = 'HABILITADO' if ferreteria.arca_habilitado else 'DESHABILITADO'
        modo = 'PRODUCCIÓN' if ferreteria.modo_arca == 'PROD' else 'HOMOLOGACIÓN'
        
        self.stdout.write(f'Estado: {estado}')
        self.stdout.write(f'Modo: {modo}')
        self.stdout.write(f'Configurado: {"SÍ" if ferreteria.arca_configurado else "NO"}')
        
        if ferreteria.certificado_arca:
            self.stdout.write(f'Certificado: CARGADO')
        else:
            self.stdout.write(f'Certificado: NO CARGADO')
            
        if ferreteria.clave_privada_arca:
            self.stdout.write(f'Clave Privada: CARGADA')
        else:
            self.stdout.write(f'Clave Privada: NO CARGADA')
            
        if ferreteria.arca_error_configuracion:
            self.stdout.write(self.style.ERROR(f'Error: {ferreteria.arca_error_configuracion}'))
            
        self.stdout.write('='*50 + '\n')

    def validar_configuracion(self, ferreteria):
        """Valida la configuración usando la nueva arquitectura"""
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('VALIDACIÓN DE CONFIGURACIÓN ARCA'))
        self.stdout.write(self.style.SUCCESS('(Usando nueva arquitectura modular)'))
        self.stdout.write('='*60)
        
        try:
            # Usar la nueva arquitectura para validación
            validation_result = validar_configuracion_arca(ferreteria.id)
            
            if validation_result['valid']:
                self.stdout.write(self.style.SUCCESS('✅ CONFIGURACIÓN VÁLIDA'))
                
                # Mostrar información del servicio
                if 'service_info' in validation_result:
                    service_info = validation_result['service_info']
                    if 'dummy_response' in service_info:
                        self.stdout.write(f'✅ Dummy AFIP: {service_info["dummy_response"]}')
                    if 'available_methods' in service_info:
                        self.stdout.write(f'✅ Métodos disponibles: {len(service_info["available_methods"])}')
                        self.stdout.write(f'  Métodos: {", ".join(service_info["available_methods"][:5])}...')
            else:
                self.stdout.write(self.style.ERROR('❌ CONFIGURACIÓN INVÁLIDA'))
                for error in validation_result.get('errors', []):
                    self.stdout.write(f'  ❌ {error}')
                for warning in validation_result.get('warnings', []):
                    self.stdout.write(f'  ⚠️  {warning}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error en validación: {e}'))
        
        self.stdout.write('='*60 + '\n')

    def probar_conectividad(self, ferreteria):
        """Prueba la conectividad usando la nueva arquitectura"""
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('PRUEBA DE CONECTIVIDAD ARCA'))
        self.stdout.write(self.style.SUCCESS('(Usando nueva arquitectura modular)'))
        self.stdout.write('='*60)
        
        try:
            # Usar la nueva arquitectura para conectividad
            connectivity_result = probar_conectividad_arca(ferreteria.id)
            
            if connectivity_result['conectividad']:
                self.stdout.write(self.style.SUCCESS('✅ CONECTIVIDAD EXITOSA'))
                if 'dummy_response' in connectivity_result:
                    self.stdout.write(f'✅ Respuesta dummy: {connectivity_result["dummy_response"]}')
                if 'mensaje' in connectivity_result:
                    self.stdout.write(f'✅ {connectivity_result["mensaje"]}')
            else:
                self.stdout.write(self.style.ERROR('❌ ERROR DE CONECTIVIDAD'))
                if 'error' in connectivity_result:
                    self.stdout.write(f'  ❌ {connectivity_result["error"]}')
                if 'mensaje' in connectivity_result:
                    self.stdout.write(f'  ❌ {connectivity_result["mensaje"]}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error en prueba de conectividad: {e}'))
        
        self.stdout.write('='*60 + '\n') 