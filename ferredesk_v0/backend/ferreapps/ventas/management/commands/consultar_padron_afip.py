"""
Comando para consultar datos del padrón de AFIP
==============================================

Este comando consulta directamente a AFIP los datos de contribuyentes
usando el servicio ws_sr_constancia_inscripcion, especialmente útil para validar
CUITs y obtener información fiscal de clientes.
"""

from django.core.management.base import BaseCommand
import json
import logging

from ferreapps.ventas.ARCA import FerreDeskARCA
from ferreapps.productos.models import Ferreteria

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Consulta datos de contribuyentes en el padrón de AFIP'

    def add_arguments(self, parser):
        parser.add_argument(
            'cuit',
            type=str,
            help='CUIT a consultar (ej: 20442740241)'
        )
        parser.add_argument(
            '--formato',
            choices=['json', 'table', 'simple'],
            default='table',
            help='Formato de salida (json, table, simple)'
        )
        parser.add_argument(
            '--validar-servicio',
            action='store_true',
            help='Validar que el servicio de padrón esté funcionando antes de consultar'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('CONSULTANDO PADRÓN DE AFIP')
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
            
            # Crear instancia de FerreDeskARCA
            arca = FerreDeskARCA(ferreteria)
            
            # Validar servicio si se solicita
            if options['validar_servicio']:
                self._validar_servicio(arca)
            
            # Consultar padrón
            cuit = options['cuit']
            self.stdout.write(f'Consultando padrón para CUIT: {cuit}...')
            datos_padron = self._consultar_padron(arca, cuit)
            
            # SIEMPRE mostrar en formato JSON para ver la respuesta completa de AFIP
            self._mostrar_json(datos_padron)
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error consultando padrón: {e}')
            )
            logger.error(f"Error en consulta padrón: {e}")

    def _validar_servicio(self, arca):
        """Valida que el servicio de padrón esté funcionando"""
        self.stdout.write('Validando servicio de padrón...')
        try:
            resultado = arca.validar_servicio_padron()
            if resultado['status'] == 'success':
                self.stdout.write(
                    self.style.SUCCESS(f"✓ {resultado['message']}")
                )
                self.stdout.write(f"Métodos disponibles: {', '.join(resultado['available_methods'])}")
            else:
                self.stdout.write(
                    self.style.WARNING(f"⚠ {resultado['message']}")
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Error validando servicio: {e}")
            )

    def _consultar_padron(self, arca, cuit):
        """
        Consulta los datos de un contribuyente en el padrón
        """
        try:
            # Usar el método existente de FerreDeskARCA que ya maneja la autenticación
            return arca.consultar_padron(cuit)
            
        except Exception as e:
            logger.error(f"Error consultando padrón para CUIT {cuit}: {e}")
            raise

    def _mostrar_json(self, datos_padron):
        """Muestra los datos del padrón en formato JSON"""
        self.stdout.write('RESPUESTA COMPLETA DE AFIP:')
        self.stdout.write('=' * 80)
        
        if datos_padron:
            # Mostrar tipo de objeto
            self.stdout.write(f'TIPO DE OBJETO: {type(datos_padron)}')
            self.stdout.write('')
            
            # Mostrar atributos disponibles
            self.stdout.write('ATRIBUTOS DISPONIBLES:')
            self.stdout.write('-' * 40)
            for attr in dir(datos_padron):
                if not attr.startswith('_'):  # Solo atributos públicos
                    self.stdout.write(f'• {attr}')
            self.stdout.write('')
            
            # Mostrar valores de cada atributo
            self.stdout.write('VALORES DE LOS ATRIBUTOS:')
            self.stdout.write('-' * 40)
            for attr in dir(datos_padron):
                if not attr.startswith('_'):  # Solo atributos públicos
                    try:
                        valor = getattr(datos_padron, attr)
                        if valor is not None:
                            self.stdout.write(f'{attr}: {valor}')
                        else:
                            self.stdout.write(f'{attr}: None')
                    except Exception as e:
                        self.stdout.write(f'{attr}: Error al obtener valor - {e}')
            self.stdout.write('')
            
            # Mostrar estructura completa (como wsfev1)
            self.stdout.write('ESTRUCTURA COMPLETA:')
            self.stdout.write('-' * 40)
            self.stdout.write(str(datos_padron))
            
        else:
            self.stdout.write('No se encontraron datos en la respuesta')

    def _mostrar_tabla(self, datos_padron):
        """Muestra los datos del padrón en formato tabla"""
        self.stdout.write('DATOS DEL PADRÓN DE AFIP:')
        self.stdout.write('=' * 80)
        
        # Procesar la respuesta SOAP original (como arca_arg)
        # La respuesta de getPersona_v2 es directamente el objeto personaReturn
        if datos_padron:
            persona = datos_padron
            
            # Datos básicos
            self.stdout.write(f"{'Campo':<25} {'Valor':<50}")
            self.stdout.write('-' * 80)
            
            # CUIT
            cuit = getattr(persona, 'idPersona', 'N/A')
            self.stdout.write(f"{'CUIT':<25} {cuit:<50}")
            
            # Tipo de persona
            tipo_persona = getattr(persona, 'tipoPersona', 'N/A')
            self.stdout.write(f"{'Tipo de Persona':<25} {tipo_persona:<50}")
            
            # Estado
            estado = getattr(persona, 'estadoClave', 'N/A')
            self.stdout.write(f"{'Estado':<25} {estado:<50}")
            
            # Datos según tipo de persona (como arca_arg)
            if hasattr(persona, 'datosGenerales') and persona.datosGenerales:
                datos_gen = persona.datosGenerales
                
                # Nombre/Razón social
                if hasattr(datos_gen, 'apellido'):
                    apellido = getattr(datos_gen, 'apellido', '')
                    nombre = getattr(datos_gen, 'nombre', '')
                    self.stdout.write(f"{'Nombre':<25} {apellido} {nombre}".strip()[:50])
                
                if hasattr(datos_gen, 'razonSocial'):
                    razon_social = getattr(datos_gen, 'razonSocial', 'N/A')
                    self.stdout.write(f"{'Razón Social':<25} {razon_social:<50}")
                
                # Tipo de documento
                tipo_doc = getattr(datos_gen, 'tipoDocumento', 'N/A')
                self.stdout.write(f"{'Tipo Documento':<25} {tipo_doc:<50}")
                
                # Número de documento
                num_doc = getattr(datos_gen, 'numeroDocumento', 'N/A')
                self.stdout.write(f"{'Número Documento':<25} {num_doc:<50}")
            
            # Domicilio fiscal (como arca_arg)
            if hasattr(persona, 'domicilioFiscal') and persona.domicilioFiscal:
                domicilio = persona.domicilioFiscal
                self.stdout.write('')
                self.stdout.write('DOMICILIO FISCAL:')
                self.stdout.write('-' * 40)
                
                direccion = getattr(domicilio, 'direccion', 'N/A')
                self.stdout.write(f"{'Dirección':<25} {direccion:<50}")
                
                cod_postal = getattr(domicilio, 'codPostal', 'N/A')
                self.stdout.write(f"{'Código Postal':<25} {cod_postal:<50}")
                
                desc_provincia = getattr(domicilio, 'descripcionProvincia', 'N/A')
                self.stdout.write(f"{'Provincia':<25} {desc_provincia:<50}")
                
                desc_localidad = getattr(domicilio, 'descripcionLocalidad', 'N/A')
                self.stdout.write(f"{'Localidad':<25} {desc_localidad:<50}")
            
            # Actividades económicas (como arca_arg)
            if hasattr(persona, 'datosRegimenGeneral') and persona.datosRegimenGeneral:
                regimen = persona.datosRegimenGeneral
                if hasattr(regimen, 'actividad') and regimen.actividad:
                    self.stdout.write('')
                    self.stdout.write('ACTIVIDADES ECONÓMICAS:')
                    self.stdout.write('-' * 40)
                    for actividad in regimen.actividad:
                        id_act = getattr(actividad, 'idActividad', 'N/A')
                        desc_act = getattr(actividad, 'descripcionActividad', 'N/A')
                        self.stdout.write(f"• {id_act}: {desc_act}")
            
            # Impuestos (como arca_arg)
            if hasattr(persona, 'datosRegimenGeneral') and persona.datosRegimenGeneral:
                regimen = persona.datosRegimenGeneral
                if hasattr(regimen, 'impuesto') and regimen.impuesto:
                    self.stdout.write('')
                    self.stdout.write('IMPUESTOS:')
                    self.stdout.write('-' * 40)
                    for impuesto in regimen.impuesto:
                        id_imp = getattr(impuesto, 'idImpuesto', 'N/A')
                        desc_imp = getattr(impuesto, 'descripcionImpuesto', 'N/A')
                        self.stdout.write(f"• {id_imp}: {desc_imp}")
            
        else:
            self.stdout.write('No se encontraron datos en la respuesta')

    def _mostrar_simple(self, datos_padron):
        """Muestra los datos del padrón de forma simple"""
        self.stdout.write('DATOS DEL PADRÓN:')
        self.stdout.write('-' * 40)
        
        # Procesar la respuesta SOAP original (como arca_arg)
        # La respuesta de getPersona_v2 es directamente el objeto personaReturn
        if datos_padron:
            persona = datos_padron
            
            # CUIT
            cuit = getattr(persona, 'idPersona', 'N/A')
            self.stdout.write(f"• CUIT: {cuit}")
            
            # Estado
            estado = getattr(persona, 'estadoClave', 'N/A')
            self.stdout.write(f"• Estado: {estado}")
            
            # Datos según tipo de persona (como arca_arg)
            if hasattr(persona, 'datosGenerales') and persona.datosGenerales:
                datos_gen = persona.datosGenerales
                
                # Nombre/Razón social
                if hasattr(datos_gen, 'apellido'):
                    apellido = getattr(datos_gen, 'apellido', '')
                    nombre = getattr(datos_gen, 'nombre', '')
                    if apellido or nombre:
                        self.stdout.write(f"• Nombre: {apellido} {nombre}".strip())
                
                if hasattr(datos_gen, 'razonSocial'):
                    razon_social = getattr(datos_gen, 'razonSocial', 'N/A')
                    if razon_social != 'N/A':
                        self.stdout.write(f"• Razón Social: {razon_social}")
            
            # Domicilio fiscal (como arca_arg)
            if hasattr(persona, 'domicilioFiscal') and persona.domicilioFiscal:
                domicilio = persona.domicilioFiscal
                direccion = getattr(domicilio, 'direccion', 'N/A')
                if direccion != 'N/A':
                    self.stdout.write(f"• Dirección: {direccion}")
                
                desc_provincia = getattr(domicilio, 'descripcionProvincia', 'N/A')
                if desc_provincia != 'N/A':
                    self.stdout.write(f"• Provincia: {desc_provincia}")
            
        else:
            self.stdout.write('No se encontraron datos en la respuesta') 