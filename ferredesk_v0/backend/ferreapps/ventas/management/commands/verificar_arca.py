from django.core.management.base import BaseCommand, CommandError
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.ARCA import validar_configuracion_arca, probar_conectividad_arca

class Command(BaseCommand):
    help = 'Verifica y configura datos faltantes de ARCA usando la nueva arquitectura modular'

    def add_arguments(self, parser):
        parser.add_argument(
            '--configurar',
            action='store_true',
            help='Configurar datos faltantes automáticamente',
        )
        parser.add_argument(
            '--punto-venta',
            type=str,
            help='Configurar punto de venta ARCA',
        )
        parser.add_argument(
            '--conectividad',
            action='store_true',
            help='Probar conectividad con AFIP',
        )
        parser.add_argument(
            '--detallado',
            action='store_true',
            help='Mostrar validación detallada usando la nueva arquitectura',
        )

    def handle(self, *args, **options):
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            self.stdout.write(
                self.style.ERROR('No existe ferretería configurada. Ejecute primero: python manage.py configurar_ferreteria')
            )
            return

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('VERIFICACIÓN DE CONFIGURACIÓN ARCA'))
        self.stdout.write(self.style.SUCCESS('(Usando nueva arquitectura modular)'))
        self.stdout.write('='*60)
        
        # Verificar datos básicos
        errores = []
        advertencias = []
        
        # CUIT/CUIL
        if not ferreteria.cuit_cuil:
            errores.append('❌ CUIT/CUIL no configurado')
        else:
            self.stdout.write(f'✅ CUIT/CUIL: {ferreteria.cuit_cuil}')
        
        # Razón Social
        if not ferreteria.razon_social:
            errores.append('❌ Razón Social no configurada')
        else:
            self.stdout.write(f'✅ Razón Social: {ferreteria.razon_social}')
        
        # Punto de Venta
        if not ferreteria.punto_venta_arca:
            errores.append('❌ Punto de Venta ARCA no configurado')
        else:
            self.stdout.write(f'✅ Punto de Venta ARCA: {ferreteria.punto_venta_arca}')
        
        # Certificados
        if not ferreteria.certificado_arca:
            errores.append('❌ Certificado ARCA no cargado')
        else:
            self.stdout.write(f'✅ Certificado ARCA: CARGADO')
        
        if not ferreteria.clave_privada_arca:
            errores.append('❌ Clave Privada ARCA no cargada')
        else:
            self.stdout.write(f'✅ Clave Privada ARCA: CARGADA')
        
        # Estado ARCA
        estado = 'HABILITADO' if ferreteria.arca_habilitado else 'DESHABILITADO'
        modo = 'PRODUCCIÓN' if ferreteria.modo_arca == 'PROD' else 'HOMOLOGACIÓN'
        
        self.stdout.write(f'✅ Estado ARCA: {estado}')
        self.stdout.write(f'✅ Modo ARCA: {modo}')
        
        # Validación detallada usando nueva arquitectura
        if options['detallado'] and not errores:
            self.stdout.write('\n' + self.style.SUCCESS('VALIDACIÓN DETALLADA (Nueva Arquitectura):'))
            self.stdout.write('-' * 50)
            
            try:
                # Usar la nueva arquitectura para validación
                validation_result = validar_configuracion_arca(ferreteria.id)
                
                if validation_result['valid']:
                    self.stdout.write(self.style.SUCCESS('✅ Configuración válida'))
                    
                    # Mostrar información del servicio
                    if 'service_info' in validation_result:
                        service_info = validation_result['service_info']
                        if 'dummy_response' in service_info:
                            self.stdout.write(f'✅ Dummy AFIP: {service_info["dummy_response"]}')
                        if 'available_methods' in service_info:
                            self.stdout.write(f'✅ Métodos disponibles: {len(service_info["available_methods"])}')
                else:
                    self.stdout.write(self.style.ERROR('❌ Configuración inválida'))
                    for error in validation_result.get('errors', []):
                        self.stdout.write(f'  ❌ {error}')
                    for warning in validation_result.get('warnings', []):
                        self.stdout.write(f'  ⚠️  {warning}')
                        
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Error en validación detallada: {e}'))
        
        # Prueba de conectividad usando nueva arquitectura
        if options['conectividad'] and not errores:
            self.stdout.write('\n' + self.style.SUCCESS('PRUEBA DE CONECTIVIDAD (Nueva Arquitectura):'))
            self.stdout.write('-' * 50)
            
            try:
                # Usar la nueva arquitectura para conectividad
                connectivity_result = probar_conectividad_arca(ferreteria.id)
                
                if connectivity_result['conectividad']:
                    self.stdout.write(self.style.SUCCESS('✅ Conectividad exitosa con AFIP'))
                    if 'dummy_response' in connectivity_result:
                        self.stdout.write(f'✅ Respuesta dummy: {connectivity_result["dummy_response"]}')
                else:
                    self.stdout.write(self.style.ERROR('❌ Error de conectividad'))
                    if 'error' in connectivity_result:
                        self.stdout.write(f'  ❌ {connectivity_result["error"]}')
                        
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Error en prueba de conectividad: {e}'))
        
        # Mostrar errores
        if errores:
            self.stdout.write('\n' + self.style.ERROR('ERRORES ENCONTRADOS:'))
            for error in errores:
                self.stdout.write(f'  {error}')
        
        # Mostrar advertencias
        if advertencias:
            self.stdout.write('\n' + self.style.WARNING('ADVERTENCIAS:'))
            for advertencia in advertencias:
                self.stdout.write(f'  {advertencia}')
        
        # Configuración automática
        if options['configurar']:
            self.stdout.write('\n' + self.style.SUCCESS('CONFIGURANDO DATOS FALTANTES...'))
            
            # Configurar punto de venta si se especifica
            if options['punto_venta']:
                ferreteria.punto_venta_arca = options['punto_venta']
                self.stdout.write(f'✅ Punto de venta configurado: {options["punto_venta"]}')
            
            # Configurar datos básicos si faltan
            if not ferreteria.cuit_cuil:
                ferreteria.cuit_cuil = '20123456789'  # CUIT de ejemplo
                self.stdout.write('✅ CUIT configurado (ejemplo): 20123456789')
            
            if not ferreteria.razon_social:
                ferreteria.razon_social = 'Mi Ferretería S.A.'  # Razón social de ejemplo
                self.stdout.write('✅ Razón social configurada (ejemplo): Mi Ferretería S.A.')
            
            if not ferreteria.punto_venta_arca:
                ferreteria.punto_venta_arca = '1'  # Punto de venta de ejemplo
                self.stdout.write('✅ Punto de venta configurado (ejemplo): 1')
            
            ferreteria.save()
            self.stdout.write(self.style.SUCCESS('✅ Configuración guardada'))
        
        # Resumen
        self.stdout.write('\n' + '='*60)
        if errores:
            self.stdout.write(self.style.ERROR(f'TOTAL ERRORES: {len(errores)}'))
            self.stdout.write(self.style.ERROR('ARCA NO FUNCIONARÁ HASTA RESOLVER LOS ERRORES'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ CONFIGURACIÓN ARCA COMPLETA'))
            self.stdout.write(self.style.SUCCESS('ARCA ESTÁ LISTO PARA FUNCIONAR'))
        
        self.stdout.write('='*60 + '\n')
        
        # Instrucciones
        if errores:
            self.stdout.write(self.style.WARNING('INSTRUCCIONES:'))
            self.stdout.write('1. Configure los datos faltantes en Configuración → ARCA')
            self.stdout.write('2. Cargue los certificados (.pem) en Configuración → ARCA')
            self.stdout.write('3. Ejecute: python manage.py verificar_arca --configurar')
            self.stdout.write('4. Ejecute: python manage.py configurar_arca --habilitar')
        else:
            self.stdout.write(self.style.SUCCESS('COMANDOS DISPONIBLES:'))
            self.stdout.write('• python manage.py verificar_arca --detallado (Validación completa)')
            self.stdout.write('• python manage.py verificar_arca --conectividad (Prueba AFIP)')
            self.stdout.write('• python manage.py configurar_arca --mostrar (Ver configuración)') 