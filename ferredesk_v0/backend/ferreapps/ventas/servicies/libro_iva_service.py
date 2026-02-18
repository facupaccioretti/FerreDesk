"""
Servicio para generar el Libro IVA Ventas.
Consolida datos de las vistas calculadas existentes sin cálculos adicionales.
"""

from decimal import Decimal
from django.utils import timezone
from typing import Dict, List, Optional, Any
from ferreapps.clientes.models import Cliente
from ferreapps.ventas.models import Venta
from ferreapps.ventas.utils import normalizar_situacion_iva
from ferreapps.productos.models import Ferreteria


def _mapear_condicion_iva_a_codigo(condicion_normalizada: str) -> str:
    """
    Mapea la condición IVA normalizada a los códigos que espera el validador.
    
    Args:
        condicion_normalizada: Condición IVA normalizada (responsable_inscripto, monotributista, etc.)
    
    Returns:
        Código de condición IVA para el validador (RI, MT, CF, EX)
    """
    mapeo = {
        'responsable_inscripto': 'RI',
        'monotributista': 'MT',
        'exento': 'EX',
        'consumidor_final': 'CF'
    }
    return mapeo.get(condicion_normalizada, '')


def generar_libro_iva_ventas(mes: int, anio: int, tipo_libro: str = 'convencional', 
                            incluir_presupuestos: bool = False, usuario: Optional[str] = None) -> Dict[str, Any]:
    """
    Genera el Libro IVA Ventas para un período específico con opciones de filtrado.
    Solo consolida datos ya calculados por las vistas del sistema.
    
    Args:
        mes: Mes del período (1-12)
        anio: Año del período (YYYY)
        tipo_libro: 'convencional' (solo fiscales) o 'administrativo' (con internos)
        incluir_presupuestos: Incluir presupuestos en libro administrativo
        usuario: Usuario que solicita la generación (opcional)
    
    Returns:
        Dict con la estructura completa del libro IVA
    """
    
    # Validaciones básicas
    if not (1 <= mes <= 12):
        raise ValueError("El mes debe estar entre 1 y 12")
    
    if anio < 2020 or anio > 2030:
        raise ValueError("El año debe estar entre 2020 y 2030")
    
    # Obtener situación IVA del emisor (ferretería)
    ferreteria = Ferreteria.objects.first()
    situacion_iva_emisor = ferreteria.situacion_iva if ferreteria else 'RI'
    emisor_normalizado = normalizar_situacion_iva(situacion_iva_emisor)
    emisor_codigo = _mapear_condicion_iva_a_codigo(emisor_normalizado)
    
    # Definir filtros según tipo de libro
    if tipo_libro == 'convencional':
        # Solo comprobantes fiscales: factura, nota_credito, nota_debito con letras A, B, C
        filtros_comprobante = {
            'comprobante_tipo__in': ['factura', 'nota_credito', 'nota_debito'],
            'comprobante_letra__in': ['A', 'B', 'C']
        }
    elif tipo_libro == 'administrativo':
        # Comprobantes fiscales + internos
        filtros_comprobante = {
            'comprobante_tipo__in': ['factura', 'nota_credito', 'nota_debito', 'factura_interna', 'nota_credito_interna']
        }
        
        # Agregar presupuestos si se solicita
        if incluir_presupuestos:
            filtros_comprobante['comprobante_tipo__in'].append('presupuesto')
    else:
        raise ValueError(f"Tipo de libro no válido: {tipo_libro}")
    
    # Obtener ventas del período usando con_calculos() del manager
    ventas_periodo = Venta.objects.con_calculos().filter(
        ven_fecha__year=anio,
        ven_fecha__month=mes,
        **filtros_comprobante
    ).order_by('ven_fecha', 'ven_punto', 'ven_numero')
    
    if not ventas_periodo.exists():
        return {
            'periodo': {
                'mes': mes,
                'anio': anio,
                'fecha_generacion': timezone.localtime().isoformat()
            },
            'emisor': {
                'situacion_iva': situacion_iva_emisor,
                'situacion_iva_normalizada': emisor_normalizado,
                'situacion_iva_codigo': emisor_codigo
            },
            'lineas': [],
            'subtotales': {
                'total_neto_sin_iva': Decimal('0.00'),
                'total_iva_21': Decimal('0.00'),
                'total_iva_105': Decimal('0.00'),
                'total_iva_27': Decimal('0.00'),
                'total_otras_iva': Decimal('0.00'),
                'total_exentos': Decimal('0.00'),
                'total_operaciones': Decimal('0.00'),
                'debito_fiscal': Decimal('0.00')
            },
            'estadisticas': {
                'total_comprobantes': 0,
                'total_operaciones': Decimal('0.00'),
                'debito_fiscal': Decimal('0.00')
            }
        }
    
    # Procesar cada venta y consolidar por alícuota
    lineas_libro = []
    subtotales = {
        'total_neto_sin_iva': Decimal('0.00'),
        'total_iva_21': Decimal('0.00'),
        'total_iva_105': Decimal('0.00'),
        'total_iva_27': Decimal('0.00'),
        'total_otras_iva': Decimal('0.00'),
        'total_exentos': Decimal('0.00'),
        'total_operaciones': Decimal('0.00'),
        'debito_fiscal': Decimal('0.00')
    }
    
    for venta in ventas_periodo:
        # Obtener datos del cliente (solo datos específicos de la venta, sin segunda prioridad)
        try:
            cliente = Cliente.objects.get(id=venta.ven_idcli)
            cuit_comprador = venta.ven_cuit or ''  # Solo usar datos específicos de la venta
            nombre_comprador = cliente.razon or cliente.fantasia or 'CLIENTE SIN NOMBRE'
            # Obtener condición IVA desde el tipo de IVA del cliente, normalizarla y mapearla
            condicion_normalizada = normalizar_situacion_iva(cliente.iva.nombre if cliente.iva else '')
            condicion_iva = _mapear_condicion_iva_a_codigo(condicion_normalizada)
        except Cliente.DoesNotExist:
            cuit_comprador = venta.ven_cuit or ''
            nombre_comprador = 'CLIENTE NO ENCONTRADO'
            condicion_iva = ''
        
        # Obtener desglose de IVA usando el nuevo método del modelo Venta
        iva_alicuotas = venta.get_iva_breakdown()
        
        # Construir número de comprobante con fallback seguro
        if venta.ven_punto and venta.ven_numero:
            numero_comprobante = f"{venta.ven_punto:04d}-{venta.ven_numero:08d}"
        else:
            # La vista VENTA_CALCULADO ya expone numero_formateado
            numero_comprobante = getattr(venta, "numero_formateado", None) or "SIN N°"
        
        # Inicializar línea del libro con los campos específicos del libro IVA fiscal
        linea_libro = {
            'fecha': venta.ven_fecha.strftime('%Y-%m-%d'),  # Formato ISO para validación
            'comprobante': venta.comprobante_nombre or 'Factura',  # Tipo de comprobante con letra (ej: "Factura A", "Nota de Crédito B")
            'numero': numero_comprobante,  # Formato 0001-00000001
            'cuit_cliente': cuit_comprador,  # CUIT del cliente (puede estar vacío)
            'razon_social': nombre_comprador,  # Razón social del cliente
            'condicion_iva': condicion_iva,  # Condición IVA del cliente (RI, CF, MT, EX)
            'neto_sin_iva': Decimal('0.00'),  # Neto sin IVA (suma de todos los netos)
            # Desgloses por alícuota requeridos para exportación TXT
            'neto_21': Decimal('0.00'),        # Neto gravado 21%
            'neto_105': Decimal('0.00'),       # Neto gravado 10.5%
            'neto_27': Decimal('0.00'),        # Neto gravado 27%
            'iva_21': Decimal('0.00'),        # IVA 21%
            'iva_105': Decimal('0.00'),       # IVA 10.5%
            'iva_27': Decimal('0.00'),        # IVA 27%
            'iva_otras': Decimal('0.00'),     # Otras alícuotas de IVA
            'importe_exento': Decimal('0.00'), # Importes exentos
            'no_gravado': Decimal('0.00'),    # Importes no gravados (para Factura C u otros casos)
            'total': venta.ven_total or Decimal('0.00')  # Total de la operación
        }

        # Campos auxiliares útiles para exportaciones (no afectan PDF/Excel actuales)
        linea_libro['ven_punto'] = venta.ven_punto
        linea_libro['ven_numero'] = venta.ven_numero
        linea_libro['comprobante_codigo_afip'] = venta.comprobante_codigo_afip
        linea_libro['comprobante_letra'] = venta.comprobante_letra
        linea_libro['ven_cae'] = venta.ven_cae
        linea_libro['ven_caevencimiento'] = venta.ven_caevencimiento
        
        # Consolidar importes por alícuota (datos ya calculados)
        neto_total_sin_iva = Decimal('0.00')  # Para calcular el neto sin IVA total
        
        for iva_alicuota in iva_alicuotas:
            alicuota = iva_alicuota.ali_porce
            # Redondear neto e IVA a 2 decimales para evitar diferencias de centavos
            neto = (iva_alicuota.neto_gravado or Decimal('0.00')).quantize(Decimal('0.01'))
            iva = (iva_alicuota.iva_total or Decimal('0.00')).quantize(Decimal('0.01'))
            
            # Acumular neto sin IVA para todas las alícuotas gravadas
            if alicuota > Decimal('0.0'):
                neto_total_sin_iva += neto
            
            if alicuota == Decimal('21.0'):
                # Neto e IVA 21%
                linea_libro['neto_21'] = linea_libro['neto_21'] + neto
                linea_libro['iva_21'] = linea_libro['iva_21'] + iva    #  ACUMULA
                subtotales['total_iva_21'] += iva
            elif alicuota == Decimal('10.5'):
                # Neto e IVA 10.5%
                linea_libro['neto_105'] = linea_libro['neto_105'] + neto
                linea_libro['iva_105'] = linea_libro['iva_105'] + iva    #  ACUMULA
                subtotales['total_iva_105'] += iva
            elif alicuota == Decimal('27.0'):
                # Neto e IVA 27%
                linea_libro['neto_27'] = linea_libro['neto_27'] + neto
                linea_libro['iva_27'] = linea_libro['iva_27'] + iva    # ACUMULA
                subtotales['total_iva_27'] += iva
            elif alicuota == Decimal('0.0'):
                # Alícuota 0%: Determinar si es exento o no gravado
                # Para simplificar, todo 0% va a exento (el sistema ya validó antes)
                linea_libro['importe_exento'] = linea_libro['importe_exento'] + neto
                subtotales['total_exentos'] += neto
            else:
                # Otras alícuotas (ej: 2.5%, 5%, etc.)
                linea_libro['iva_otras'] = linea_libro['iva_otras'] + iva
                subtotales['total_otras_iva'] = subtotales.get('total_otras_iva', Decimal('0.00')) + iva
        
        # Asignar el neto sin IVA total
        linea_libro['neto_sin_iva'] = neto_total_sin_iva
        subtotales['total_neto_sin_iva'] += neto_total_sin_iva
        
        # Verificar que el total calculado coincida con el total de la venta
        total_calculado = (
            linea_libro['neto_sin_iva'] + 
            linea_libro['iva_21'] + linea_libro['iva_105'] + linea_libro['iva_27'] + linea_libro['iva_otras'] +
            linea_libro['importe_exento']
        )
        
        # Agregar información de verificación para debugging
        linea_libro['total_calculado'] = total_calculado
        linea_libro['diferencia'] = abs(linea_libro['total'] - total_calculado)
        
        lineas_libro.append(linea_libro)
        subtotales['total_operaciones'] += linea_libro['total']
    
    # Calcular débito fiscal total (suma de IVA por alícuotas)
    subtotales['debito_fiscal'] = (
        subtotales['total_iva_21'] + 
        subtotales['total_iva_105'] + 
        subtotales['total_iva_27'] +
        subtotales.get('total_otras_iva', Decimal('0.00'))
    )
    
    # Estructura de respuesta
    resultado = {
        'periodo': {
            'mes': mes,
            'anio': anio,
            'fecha_generacion': timezone.localtime().isoformat()
        },
        'emisor': {
            'situacion_iva': situacion_iva_emisor,
            'situacion_iva_normalizada': emisor_normalizado,
            'situacion_iva_codigo': emisor_codigo
        },
        'configuracion': {
            'tipo_libro': tipo_libro,
            'incluir_presupuestos': incluir_presupuestos
        },
        'lineas': lineas_libro,
        'subtotales': subtotales,
        'estadisticas': {
            'total_comprobantes': len(lineas_libro),
            'total_operaciones': subtotales['total_operaciones'],
            'debito_fiscal': subtotales['debito_fiscal']
        }
    }
    
    return resultado


def validar_integridad_libro_iva(datos_libro: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Valida la integridad básica de los datos del libro IVA.
    Solo verifica que los datos estén presentes, no hace cálculos adicionales.
    
    Args:
        datos_libro: Datos consolidados del libro IVA
    
    Returns:
        Dict con errores y advertencias encontradas
    """
    errores = []
    advertencias = []
    
    # Validar estructura básica
    if 'lineas' not in datos_libro or 'subtotales' not in datos_libro:
        errores.append("Estructura de datos inválida")
        return {'errores': errores, 'advertencias': advertencias}
    
    # Verificar que hay datos
    if not datos_libro['lineas']:
        advertencias.append("No hay comprobantes en el período seleccionado")
    
    return {'errores': errores, 'advertencias': advertencias} 