from django.core.management.base import BaseCommand, CommandError
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.ARCA import (
    validar_configuracion_arca, 
    probar_conectividad_arca,
    FerreDeskARCA,
    FerreDeskARCAError
)

class Command(BaseCommand):
    help = 'Pruebas avanzadas de ARCA usando la nueva arquitectura modular'

    def add_arguments(self, parser):
        parser.add_argument(
            '--validar',
            action='store_true',
            help='Validar configuración completa',
        )
        parser.add_argument(
            '--conectividad',
            action='store_true',
            help='Probar conectividad con AFIP',
        )
        parser.add_argument(
            '--ultimo-numero',
            type=int,
            help='Consultar último número autorizado para tipo de comprobante',
        )
        parser.add_argument(
            '--punto-venta',
            type=int,
            help='Punto de venta para consulta (por defecto usa el configurado)',
        )
        parser.add_argument(
            '--completo',
            action='store_true',
            help='Ejecutar todas las pruebas',
        )
        parser.add_argument(
            '--tipos-comprobante',
            action='store_true',
            help='Consultar tipos de comprobante válidos en AFIP',
        )
        parser.add_argument(
            '--tipos-documento',
            action='store_true',
            help='Consultar tipos de documento válidos en AFIP',
        )
        parser.add_argument(
            '--alicuotas-iva',
            action='store_true',
            help='Consultar alícuotas de IVA válidas en AFIP',
        )
        parser.add_argument(
            '--todos-parametros',
            action='store_true',
            help='Consultar todos los parámetros válidos en AFIP',
        )

    def handle(self, *args, **options):
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            self.stdout.write(
                self.style.ERROR('No existe ferretería configurada. Ejecute primero: python manage.py configurar_ferreteria')
            )
            return

        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.SUCCESS('PRUEBAS AVANZADAS DE ARCA'))
        self.stdout.write(self.style.SUCCESS('(Nueva Arquitectura Modular)'))
        self.stdout.write('='*70)

        # Ejecutar todas las pruebas
        if options['completo']:
            self.probar_validacion(ferreteria)
            self.probar_conectividad(ferreteria)
            self.probar_ultimo_numero(ferreteria, 1)  # Factura A
            self.probar_ultimo_numero(ferreteria, 6)  # Factura B
            self.probar_ultimo_numero(ferreteria, 11) # Factura C
            self.probar_todos_parametros(ferreteria)
            return

        # Pruebas individuales
        if options['validar']:
            self.probar_validacion(ferreteria)

        if options['conectividad']:
            self.probar_conectividad(ferreteria)

        if options['ultimo_numero']:
            punto_venta = options['punto_venta'] or ferreteria.punto_venta_arca
            self.probar_ultimo_numero(ferreteria, options['ultimo_numero'], punto_venta)

        # Pruebas de parámetros
        if options['tipos_comprobante']:
            self.probar_tipos_comprobante(ferreteria)

        if options['tipos_documento']:
            self.probar_tipos_documento(ferreteria)

        if options['alicuotas_iva']:
            self.probar_alicuotas_iva(ferreteria)

        if options['todos_parametros']:
            self.probar_todos_parametros(ferreteria)

        # Si no se especificó ninguna opción, mostrar ayuda
        if not any([options['validar'], options['conectividad'], options['ultimo_numero'], 
                   options['tipos_comprobante'], options['tipos_documento'], options['alicuotas_iva'],
                   options['todos_parametros'], options['completo']]):
            self.mostrar_ayuda()

    def probar_validacion(self, ferreteria):
        """Prueba la validación de configuración"""
        self.stdout.write('\n' + self.style.SUCCESS('🔍 VALIDACIÓN DE CONFIGURACIÓN'))
        self.stdout.write('-' * 50)
        
        try:
            validation_result = validar_configuracion_arca(ferreteria.id)
            
            if validation_result['valid']:
                self.stdout.write(self.style.SUCCESS('✅ Configuración válida'))
                
                # Mostrar información detallada
                if 'service_info' in validation_result:
                    service_info = validation_result['service_info']
                    
                    if 'dummy_response' in service_info:
                        dummy = service_info['dummy_response']
                        self.stdout.write(f'✅ Dummy AFIP: {dummy}')
                    
                    if 'available_methods' in service_info:
                        methods = service_info['available_methods']
                        self.stdout.write(f'✅ Métodos disponibles: {len(methods)}')
                        self.stdout.write(f'  Principales: {", ".join(methods[:10])}')
            else:
                self.stdout.write(self.style.ERROR('❌ Configuración inválida'))
                for error in validation_result.get('errors', []):
                    self.stdout.write(f'  ❌ {error}')
                for warning in validation_result.get('warnings', []):
                    self.stdout.write(f'  ⚠️  {warning}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error en validación: {e}'))

    def probar_conectividad(self, ferreteria):
        """Prueba la conectividad con AFIP"""
        self.stdout.write('\n' + self.style.SUCCESS('🌐 PRUEBA DE CONECTIVIDAD'))
        self.stdout.write('-' * 50)
        
        try:
            connectivity_result = probar_conectividad_arca(ferreteria.id)
            
            if connectivity_result['conectividad']:
                self.stdout.write(self.style.SUCCESS('✅ Conectividad exitosa'))
                
                if 'dummy_response' in connectivity_result:
                    dummy = connectivity_result['dummy_response']
                    self.stdout.write(f'✅ Respuesta dummy: {dummy}')
                
                if 'mensaje' in connectivity_result:
                    self.stdout.write(f'✅ {connectivity_result["mensaje"]}')
            else:
                self.stdout.write(self.style.ERROR('❌ Error de conectividad'))
                if 'error' in connectivity_result:
                    self.stdout.write(f'  ❌ {connectivity_result["error"]}')
                if 'mensaje' in connectivity_result:
                    self.stdout.write(f'  ❌ {connectivity_result["mensaje"]}')
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error en conectividad: {e}'))

    def probar_ultimo_numero(self, ferreteria, tipo_comprobante, punto_venta=None):
        """Prueba la consulta del último número autorizado"""
        if not punto_venta:
            punto_venta = ferreteria.punto_venta_arca
        
        tipo_nombre = {
            1: 'Factura A',
            6: 'Factura B', 
            11: 'Factura C',
            3: 'Nota Crédito A',
            8: 'Nota Crédito B',
            13: 'Nota Crédito C'
        }.get(tipo_comprobante, f'Tipo {tipo_comprobante}')
        
        self.stdout.write(f'\n{self.style.SUCCESS("📊 CONSULTA ÚLTIMO NÚMERO")}')
        self.stdout.write(f'{self.style.SUCCESS(f"({tipo_nombre} - Punto {punto_venta})")}')
        self.stdout.write('-' * 50)
        
        try:
            # Crear instancia de FerreDeskARCA
            arca = FerreDeskARCA(ferreteria)
            
            # Consultar último número
            ultimo_numero = arca.obtener_ultimo_numero_autorizado(tipo_comprobante)
            
            self.stdout.write(self.style.SUCCESS(f'✅ Último número autorizado: {ultimo_numero - 1}'))
            self.stdout.write(self.style.SUCCESS(f'✅ Próximo número a usar: {ultimo_numero}'))
            
        except FerreDeskARCAError as e:
            self.stdout.write(self.style.ERROR(f'❌ Error ARCA: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error inesperado: {e}'))

    def mostrar_ayuda(self):
        """Muestra ayuda sobre los comandos disponibles"""
        self.stdout.write('\n' + self.style.SUCCESS('📋 COMANDOS DISPONIBLES:'))
        self.stdout.write('• python manage.py probar_arca --completo')
        self.stdout.write('  (Ejecuta todas las pruebas)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --validar')
        self.stdout.write('  (Valida configuración completa)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --conectividad')
        self.stdout.write('  (Prueba conectividad con AFIP)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --ultimo-numero 1')
        self.stdout.write('  (Consulta último número para Factura A)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --ultimo-numero 6 --punto-venta 2')
        self.stdout.write('  (Consulta último número para Factura B en punto 2)')
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('TIPOS DE COMPROBANTE:'))
        self.stdout.write('  1 = Factura A, 6 = Factura B, 11 = Factura C')
        self.stdout.write('  3 = Nota Crédito A, 8 = Nota Crédito B, 13 = Nota Crédito C')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --tipos-comprobante')
        self.stdout.write('  (Consulta tipos de comprobante válidos)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --tipos-documento')
        self.stdout.write('  (Consulta tipos de documento válidos)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --alicuotas-iva')
        self.stdout.write('  (Consulta alícuotas de IVA válidas)')
        self.stdout.write('')
        self.stdout.write('• python manage.py probar_arca --todos-parametros')
        self.stdout.write('  (Consulta todos los parámetros válidos)')

    def probar_tipos_comprobante(self, ferreteria):
        """Prueba la consulta de tipos de comprobante válidos"""
        self.stdout.write('\n' + self.style.SUCCESS('📋 TIPOS DE COMPROBANTE VÁLIDOS'))
        self.stdout.write('-' * 50)
        
        try:
            arca = FerreDeskARCA(ferreteria)
            
            # Primero verificar qué métodos están disponibles
            self.stdout.write(self.style.WARNING('🔍 Verificando métodos disponibles...'))
            methods = arca.wsfev1_service.get_methods()
            
            # Buscar métodos relacionados con parámetros
            param_methods = [m for m in methods if 'Param' in m or 'Tipo' in m or 'Alicuota' in m]
            if param_methods:
                self.stdout.write(self.style.SUCCESS(f'✅ Métodos de parámetros encontrados: {param_methods}'))
            else:
                self.stdout.write(self.style.WARNING('⚠️  No se encontraron métodos de parámetros'))
                self.stdout.write(self.style.WARNING('Métodos disponibles:'))
                for method in methods[:20]:  # Mostrar primeros 20
                    self.stdout.write(f'  • {method}')
                if len(methods) > 20:
                    self.stdout.write(f'  ... y {len(methods) - 20} más')
                return
            
            # Intentar con el método correcto si existe
            tipos = arca.consultar_tipos_comprobante()
            
            if hasattr(tipos, 'ResultGet') and hasattr(tipos.ResultGet, 'FEParamGetTiposComprobanteResult'):
                resultado = tipos.ResultGet.FEParamGetTiposComprobanteResult
                
                if hasattr(resultado, 'Errors') and resultado.Errors:
                    self.stdout.write(self.style.ERROR('❌ Errores en consulta:'))
                    for error in resultado.Errors.Err:
                        self.stdout.write(f'  ❌ {error.Code}: {error.Msg}')
                else:
                    self.stdout.write(self.style.SUCCESS('✅ Tipos de comprobante válidos:'))
                    if hasattr(resultado, 'ResultGet') and resultado.ResultGet:
                        for tipo in resultado.ResultGet.FETipoComprobante:
                            self.stdout.write(f'  📄 {tipo.Id}: {tipo.Desc} ({tipo.FchDesde} - {tipo.FchHasta})')
                    else:
                        self.stdout.write('  ⚠️  No se encontraron tipos de comprobante')
            else:
                self.stdout.write(self.style.WARNING('⚠️  Estructura de respuesta inesperada'))
                self.stdout.write(f'  Respuesta: {tipos}')
                
        except FerreDeskARCAError as e:
            self.stdout.write(self.style.ERROR(f'❌ Error ARCA: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error inesperado: {e}'))

    def probar_tipos_documento(self, ferreteria):
        """Prueba la consulta de tipos de documento válidos"""
        self.stdout.write('\n' + self.style.SUCCESS('🆔 TIPOS DE DOCUMENTO VÁLIDOS'))
        self.stdout.write('-' * 50)
        
        try:
            arca = FerreDeskARCA(ferreteria)
            tipos = arca.consultar_tipos_documento()
            
            if hasattr(tipos, 'ResultGet') and hasattr(tipos.ResultGet, 'FEParamGetTiposDocumentoResult'):
                resultado = tipos.ResultGet.FEParamGetTiposDocumentoResult
                
                if hasattr(resultado, 'Errors') and resultado.Errors:
                    self.stdout.write(self.style.ERROR('❌ Errores en consulta:'))
                    for error in resultado.Errors.Err:
                        self.stdout.write(f'  ❌ {error.Code}: {error.Msg}')
                else:
                    self.stdout.write(self.style.SUCCESS('✅ Tipos de documento válidos:'))
                    if hasattr(resultado, 'ResultGet') and resultado.ResultGet:
                        for tipo in resultado.ResultGet.FETipoDocumento:
                            self.stdout.write(f'  🆔 {tipo.Id}: {tipo.Desc} ({tipo.FchDesde} - {tipo.FchHasta})')
                    else:
                        self.stdout.write('  ⚠️  No se encontraron tipos de documento')
            else:
                self.stdout.write(self.style.WARNING('⚠️  Estructura de respuesta inesperada'))
                self.stdout.write(f'  Respuesta: {tipos}')
                
        except FerreDeskARCAError as e:
            self.stdout.write(self.style.ERROR(f'❌ Error ARCA: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error inesperado: {e}'))

    def probar_alicuotas_iva(self, ferreteria):
        """Prueba la consulta de alícuotas de IVA válidas"""
        self.stdout.write('\n' + self.style.SUCCESS('💰 ALÍCUOTAS DE IVA VÁLIDAS'))
        self.stdout.write('-' * 50)
        
        try:
            arca = FerreDeskARCA(ferreteria)
            alicuotas = arca.consultar_alicuotas_iva()
            
            if hasattr(alicuotas, 'ResultGet') and hasattr(alicuotas.ResultGet, 'FEParamGetAlicuotasIVAResult'):
                resultado = alicuotas.ResultGet.FEParamGetAlicuotasIVAResult
                
                if hasattr(resultado, 'Errors') and resultado.Errors:
                    self.stdout.write(self.style.ERROR('❌ Errores en consulta:'))
                    for error in resultado.Errors.Err:
                        self.stdout.write(f'  ❌ {error.Code}: {error.Msg}')
                else:
                    self.stdout.write(self.style.SUCCESS('✅ Alícuotas de IVA válidas:'))
                    if hasattr(resultado, 'ResultGet') and resultado.ResultGet:
                        for alicuota in resultado.ResultGet.FEAlicuotaIVA:
                            self.stdout.write(f'  💰 {alicuota.Id}: {alicuota.Desc} ({alicuota.FchDesde} - {alicuota.FchHasta})')
                    else:
                        self.stdout.write('  ⚠️  No se encontraron alícuotas de IVA')
            else:
                self.stdout.write(self.style.WARNING('⚠️  Estructura de respuesta inesperada'))
                self.stdout.write(f'  Respuesta: {alicuotas}')
                
        except FerreDeskARCAError as e:
            self.stdout.write(self.style.ERROR(f'❌ Error ARCA: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error inesperado: {e}'))

    def probar_todos_parametros(self, ferreteria):
        """Prueba la consulta de todos los parámetros válidos"""
        self.stdout.write('\n' + self.style.SUCCESS('🔍 TODOS LOS PARÁMETROS VÁLIDOS'))
        self.stdout.write('=' * 70)
        
        self.probar_tipos_comprobante(ferreteria)
        self.probar_tipos_documento(ferreteria)
        self.probar_alicuotas_iva(ferreteria) 