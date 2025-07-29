"""
Comando para consultar las condiciones IVA válidas en AFIP
=========================================================

Este comando consulta directamente a AFIP qué condiciones IVA son válidas
para cada tipo de comprobante, especialmente útil para entender las reglas
de validación de AFIP.
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
import json
import logging

from ferreapps.ventas.ARCA import FerreDeskARCA
from ferreapps.productos.models import Ferreteria

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Consulta las condiciones IVA válidas en AFIP para cada tipo de comprobante'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tipo-comprobante',
            type=int,
            help='Tipo de comprobante específico a consultar (ej: 6 para Factura B)'
        )
        parser.add_argument(
            '--clase-comprobante',
            type=str,
            default='B',
            choices=['A', 'B', 'C', 'M', '49'],
            help='Clase de comprobante para consultar condiciones IVA (A, B, C, M, 49)'
        )
        parser.add_argument(
            '--formato',
            choices=['json', 'table', 'simple'],
            default='table',
            help='Formato de salida (json, table, simple)'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('CONSULTANDO CONDICIONES IVA VÁLIDAS EN AFIP')
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
            
            # Consultar condiciones IVA válidas para la clase de comprobante especificada
            clase_comprobante = options['clase_comprobante']
            self.stdout.write(f'Consultando condiciones IVA válidas para clase de comprobante {clase_comprobante}...')
            condiciones_iva = self._consultar_condiciones_iva_por_clase(arca, clase_comprobante)
            
            if options['formato'] == 'json':
                self._mostrar_json(condiciones_iva)
            elif options['formato'] == 'table':
                self._mostrar_tabla(condiciones_iva)
            else:
                self._mostrar_simple(condiciones_iva)
            
            # Si se especificó un tipo de comprobante, mostrar información específica
            if options['tipo_comprobante']:
                self._mostrar_info_comprobante(arca, options['tipo_comprobante'])
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error consultando AFIP: {e}')
            )
            logger.error(f"Error en consulta AFIP: {e}")

    def _consultar_condiciones_iva_por_clase(self, arca, clase_comprobante):
        """
        Consulta las condiciones IVA válidas para una clase de comprobante específica
        """
        try:
            # Usar el método existente de FerreDeskARCA que ya maneja la autenticación
            return arca.consultar_condicion_iva_receptor(clase_comprobante)
            
        except Exception as e:
            logger.error(f"Error consultando condiciones IVA para clase {clase_comprobante}: {e}")
            raise

    def _mostrar_json(self, condiciones_iva):
        """Muestra las condiciones IVA en formato JSON"""
        self.stdout.write('RESPUESTA COMPLETA DE AFIP:')
        self.stdout.write(json.dumps(condiciones_iva, indent=2, default=str))

    def _mostrar_tabla(self, condiciones_iva):
        """Muestra las condiciones IVA en formato tabla"""
        self.stdout.write('CONDICIONES IVA VÁLIDAS EN AFIP:')
        self.stdout.write('=' * 80)
        self.stdout.write(f"{'ID':<5} {'Descripción':<40} {'Clase':<10}")
        self.stdout.write('-' * 80)
        
        # Procesar la respuesta SOAP original (como arca_arg)
        if hasattr(condiciones_iva, 'ResultGet') and condiciones_iva.ResultGet:
            result_get = condiciones_iva.ResultGet
            if hasattr(result_get, 'CondicionIvaReceptor'):
                for condicion in result_get.CondicionIvaReceptor:
                    id_cond = getattr(condicion, 'Id', 'N/A')
                    desc = getattr(condicion, 'Desc', 'N/A')
                    clase = getattr(condicion, 'Cmp_Clase', 'N/A')
                    
                    self.stdout.write(f"{id_cond:<5} {desc:<40} {clase:<10}")
            else:
                self.stdout.write('No se encontró CondicionIvaReceptor en ResultGet')
        else:
            self.stdout.write('No se encontraron condiciones IVA en la respuesta')

    def _mostrar_simple(self, condiciones_iva):
        """Muestra las condiciones IVA de forma simple"""
        self.stdout.write('CONDICIONES IVA DISPONIBLES:')
        self.stdout.write('-' * 40)
        
        # Procesar la respuesta SOAP original (como arca_arg)
        if hasattr(condiciones_iva, 'ResultGet') and condiciones_iva.ResultGet:
            result_get = condiciones_iva.ResultGet
            if hasattr(result_get, 'CondicionIvaReceptor'):
                for condicion in result_get.CondicionIvaReceptor:
                    id_cond = getattr(condicion, 'Id', 'N/A')
                    desc = getattr(condicion, 'Desc', 'N/A')
                    self.stdout.write(f"• {id_cond}: {desc}")
            else:
                self.stdout.write('No se encontraron condiciones IVA')
        else:
            self.stdout.write('No se encontraron condiciones IVA')

    def _mostrar_info_comprobante(self, arca, tipo_comprobante):
        """Muestra información específica para un tipo de comprobante"""
        self.stdout.write('')
        self.stdout.write('=' * 80)
        self.stdout.write(f'INFORMACIÓN ESPECÍFICA PARA COMPROBANTE TIPO {tipo_comprobante}')
        self.stdout.write('=' * 80)
        
        # Mapeo de tipos de comprobante
        tipos_comprobante = {
            1: 'Factura A',
            2: 'Nota de Débito A', 
            3: 'Nota de Crédito A',
            6: 'Factura B',
            7: 'Nota de Débito B',
            8: 'Nota de Crédito B',
            11: 'Factura C',
            12: 'Nota de Débito C',
            13: 'Nota de Crédito C'
        }
        
        # Mapeo de clases de comprobante
        clases_comprobante = {
            'A': 'Factura A, Nota de Débito A, Nota de Crédito A',
            'B': 'Factura B, Nota de Débito B, Nota de Crédito B',
            'C': 'Factura C, Nota de Débito C, Nota de Crédito C',
            'M': 'Comprobantes M',
            '49': 'Otros comprobantes'
        }
        
        nombre_comprobante = tipos_comprobante.get(tipo_comprobante, f'Tipo {tipo_comprobante}')
        self.stdout.write(f'Comprobante: {nombre_comprobante}')
        
        # Determinar clase de comprobante
        clase_comprobante = None
        if tipo_comprobante in [1, 2, 3]:
            clase_comprobante = 'A'
        elif tipo_comprobante in [6, 7, 8]:
            clase_comprobante = 'B'
        elif tipo_comprobante in [11, 12, 13]:
            clase_comprobante = 'C'
        
        if clase_comprobante:
            self.stdout.write(f'Clase de comprobante: {clase_comprobante} ({clases_comprobante[clase_comprobante]})')
        
        # Reglas específicas según el tipo
        if tipo_comprobante == 6:  # Factura B
            self.stdout.write('')
            self.stdout.write('REGLAS ESPECÍFICAS PARA FACTURA B:')
            self.stdout.write('• Para Consumidor Final: NO enviar CondicionIVAReceptorId')
            self.stdout.write('• Para otros tipos: Usar CondicionIVAReceptorId correspondiente')
            self.stdout.write('• Documento: Puede ser CUIT, DNI o Consumidor Final (99)')
        
        elif tipo_comprobante == 1:  # Factura A
            self.stdout.write('')
            self.stdout.write('REGLAS ESPECÍFICAS PARA FACTURA A:')
            self.stdout.write('• Requiere CUIT del cliente obligatoriamente')
            self.stdout.write('• CondicionIVAReceptorId: Obligatorio')
            self.stdout.write('• Documento: Solo CUIT (80)')
        
        elif tipo_comprobante == 11:  # Factura C
            self.stdout.write('')
            self.stdout.write('REGLAS ESPECÍFICAS PARA FACTURA C:')
            self.stdout.write('• Para Consumidor Final: NO enviar CondicionIVAReceptorId')
            self.stdout.write('• Para otros tipos: Usar CondicionIVAReceptorId correspondiente')
            self.stdout.write('• Documento: Puede ser CUIT, DNI o Consumidor Final (99)')
        
        # Mostrar información sobre clases de comprobante
        self.stdout.write('')
        self.stdout.write('CLASES DE COMPROBANTE DISPONIBLES (SEGÚN AFIP):')
        self.stdout.write('• Clase A: Factura A, Nota de Débito A, Nota de Crédito A')
        self.stdout.write('• Clase B: Factura B, Nota de Débito B, Nota de Crédito B')
        self.stdout.write('• Clase C: Factura C, Nota de Débito C, Nota de Crédito C')
        self.stdout.write('• Clase M: Comprobantes M')
        self.stdout.write('• Clase 49: Otros comprobantes')
        
        # Consultar tipos de documento válidos
        try:
            self.stdout.write('')
            self.stdout.write('CONSULTANDO TIPOS DE DOCUMENTO VÁLIDOS...')
            tipos_doc = arca.consultar_tipos_documento()
            
            if 'ResultGet' in tipos_doc and tipos_doc['ResultGet']:
                self.stdout.write('TIPOS DE DOCUMENTO DISPONIBLES:')
                for tipo_doc in tipos_doc['ResultGet'].get('TiposDoc', []):
                    id_doc = tipo_doc.get('Id', 'N/A')
                    desc = tipo_doc.get('Desc', 'N/A')
                    self.stdout.write(f"• {id_doc}: {desc}")
        except Exception as e:
            self.stdout.write(f'Error consultando tipos de documento: {e}') 