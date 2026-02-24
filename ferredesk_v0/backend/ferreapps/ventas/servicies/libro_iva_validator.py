"""
Servicio de validación para el Libro IVA Ventas.
Verifica la integridad y consistencia de los datos según las regulaciones argentinas.
"""

from decimal import Decimal
from typing import Dict, List, Any, Tuple
from datetime import datetime, date
from ferreapps.ventas.models import Venta, Comprobante
from ferreapps.clientes.models import Cliente


def validar_libro_iva(datos_libro: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Valida la integridad y consistencia de los datos del libro IVA.
    
    Args:
        datos_libro: Datos consolidados del libro IVA
    
    Returns:
        Dict con errores y advertencias encontradas
    """
    
    errores = []
    advertencias = []
    
    # Validaciones básicas de estructura
    errores_estructura, advertencias_estructura = _validar_estructura_datos(datos_libro)
    errores.extend(errores_estructura)
    advertencias.extend(advertencias_estructura)
    
    # Validaciones de integridad matemática
    errores_matematicos, advertencias_matematicas = _validar_integridad_matematica(datos_libro)
    errores.extend(errores_matematicos)
    advertencias.extend(advertencias_matematicas)
    
    # Validaciones fiscales
    errores_fiscales, advertencias_fiscales = _validar_reglas_fiscales(datos_libro)
    errores.extend(errores_fiscales)
    advertencias.extend(advertencias_fiscales)
    
    # Validaciones de completitud
    errores_completitud, advertencias_completitud = _validar_completitud_datos(datos_libro)
    errores.extend(errores_completitud)
    advertencias.extend(advertencias_completitud)
    
    return {
        'errores': errores,
        'advertencias': advertencias
    }


def _validar_estructura_datos(datos_libro: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """
    Valida la estructura básica de los datos del libro IVA.
    """
    
    errores = []
    advertencias = []
    
    # Verificar campos obligatorios
    campos_obligatorios = ['periodo', 'lineas', 'subtotales', 'estadisticas']
    for campo in campos_obligatorios:
        if campo not in datos_libro:
            errores.append(f"Campo obligatorio faltante: {campo}")
    
    # Verificar estructura del período
    if 'periodo' in datos_libro:
        periodo = datos_libro['periodo']
        if not isinstance(periodo, dict):
            errores.append("El campo 'periodo' debe ser un diccionario")
        else:
            if 'mes' not in periodo or 'anio' not in periodo:
                errores.append("El período debe contener 'mes' y 'anio'")
            else:
                if not (1 <= periodo['mes'] <= 12):
                    errores.append("El mes debe estar entre 1 y 12")
                if not (2020 <= periodo['anio'] <= 2030):
                    advertencias.append("El año está fuera del rango esperado (2020-2030)")
    
    # Verificar estructura de líneas
    if 'lineas' in datos_libro:
        if not isinstance(datos_libro['lineas'], list):
            errores.append("El campo 'lineas' debe ser una lista")
        else:
            # Verificar estructura de cada línea
            campos_linea = [
                'fecha', 'comprobante', 'numero', 'cuit_cliente', 'razon_social',
                'neto_sin_iva', 'iva_21', 'iva_105', 'iva_27', 'iva_otras',
                'importe_exento', 'total'
            ]
            
            for i, linea in enumerate(datos_libro['lineas']):
                if not isinstance(linea, dict):
                    errores.append(f"Línea {i+1}: Debe ser un diccionario")
                    continue
                
                for campo in campos_linea:
                    if campo not in linea:
                        advertencias.append(f"Línea {i+1}: Campo faltante '{campo}'")
    
    return errores, advertencias


def _validar_integridad_matematica(datos_libro: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """
    Valida la integridad matemática de los cálculos del libro IVA.
    """
    
    errores = []
    advertencias = []
    
    if 'lineas' not in datos_libro:
        return errores, advertencias
    
    # Validar cada línea
    for i, linea in enumerate(datos_libro['lineas']):
        # Validar que neto sin IVA + IVA + exentos = total
        neto_sin_iva = linea.get('neto_sin_iva', Decimal('0.00'))
        iva_total = (
            linea.get('iva_21', Decimal('0.00')) + 
            linea.get('iva_105', Decimal('0.00')) + 
            linea.get('iva_27', Decimal('0.00')) +
            linea.get('iva_otras', Decimal('0.00'))
        )
        importe_exento = linea.get('importe_exento', Decimal('0.00'))
        
        total = linea.get('total', Decimal('0.00'))
        total_sumado = neto_sin_iva + iva_total + importe_exento
        
        # Calcular diferencia entre total calculado y total de operación
        diferencia = abs(total - total_sumado)
        
        # Usar la diferencia calculada en el servicio si está disponible
        diferencia_calculada = linea.get('diferencia', Decimal('0.00'))
        # Toleramos diferencias menores a 5 centavos por redondeos
        if diferencia_calculada > Decimal('0.05'):
            total_calculado = linea.get('total_calculado', total_sumado)
            advertencias.append(
                f"Línea {i+1}: Diferencia de ${diferencia_calculada} entre total calculado (${total_calculado}) "
                f"y total de operación (${total}). "
                f"Posible causa: múltiples alícuotas en la misma venta o redondeos."
            )
        elif diferencia > Decimal('0.05'):
            advertencias.append(
                f"Línea {i+1}: Diferencia de ${diferencia} entre total calculado y total de operación"
            )
        
        # Validar que los importes no sean negativos
        campos_numericos = ['neto_sin_iva', 'iva_21', 'iva_105', 'iva_27', 'iva_otras', 
                           'importe_exento', 'total']
        for campo in campos_numericos:
            valor = linea.get(campo, Decimal('0.00'))
            if valor < Decimal('0.00'):
                errores.append(f"Línea {i+1}: Campo '{campo}' no puede ser negativo: {valor}")
    
    # Validar subtotales
    if 'subtotales' in datos_libro:
        subtotales = datos_libro['subtotales']
        
        # Calcular subtotales desde las líneas
        total_neto_sin_iva_calc = sum(linea.get('neto_sin_iva', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_iva_21_calc = sum(linea.get('iva_21', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_iva_105_calc = sum(linea.get('iva_105', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_iva_27_calc = sum(linea.get('iva_27', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_iva_otras_calc = sum(linea.get('iva_otras', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_exentos_calc = sum(linea.get('importe_exento', Decimal('0.00')) for linea in datos_libro['lineas'])
        total_operaciones_calc = sum(linea.get('total', Decimal('0.00')) for linea in datos_libro['lineas'])
        
        # Comparar con subtotales declarados
        if abs(subtotales.get('total_neto_sin_iva', Decimal('0.00')) - total_neto_sin_iva_calc) > Decimal('0.01'):
            advertencias.append("Subtotal neto sin IVA no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_iva_21', Decimal('0.00')) - total_iva_21_calc) > Decimal('0.01'):
            advertencias.append("Subtotal IVA 21% no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_iva_105', Decimal('0.00')) - total_iva_105_calc) > Decimal('0.01'):
            advertencias.append("Subtotal IVA 10.5% no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_iva_27', Decimal('0.00')) - total_iva_27_calc) > Decimal('0.01'):
            advertencias.append("Subtotal IVA 27% no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_otras_iva', Decimal('0.00')) - total_iva_otras_calc) > Decimal('0.01'):
            advertencias.append("Subtotal IVA otras alícuotas no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_exentos', Decimal('0.00')) - total_exentos_calc) > Decimal('0.01'):
            advertencias.append("Subtotal exentos no coincide con la suma de líneas")
        
        if abs(subtotales.get('total_operaciones', Decimal('0.00')) - total_operaciones_calc) > Decimal('0.01'):
            advertencias.append("Total operaciones no coincide con la suma de líneas")
        
        # Validar débito fiscal
        debito_fiscal_calc = total_iva_21_calc + total_iva_105_calc + total_iva_27_calc + total_iva_otras_calc
        if abs(subtotales.get('debito_fiscal', Decimal('0.00')) - debito_fiscal_calc) > Decimal('0.01'):
            errores.append("Débito fiscal no coincide con la suma de IVA por alícuotas")
    
    return errores, advertencias


def _validar_reglas_fiscales(datos_libro: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """
    Valida reglas básicas del libro IVA.
    No hace validaciones estrictas ya que el sistema las maneja antes.
    """
    
    errores = []
    advertencias = []
    
    if 'lineas' not in datos_libro:
        return errores, advertencias
    
    # Solo validaciones básicas
    for i, linea in enumerate(datos_libro['lineas']):
        # Validar que no haya importes negativos (regla matemática básica)
        campos_numericos = [
            'neto_sin_iva', 'iva_21', 'iva_105', 'iva_27', 'iva_otras',
            'importe_exento', 'total'
        ]
        for campo in campos_numericos:
            valor = linea.get(campo, Decimal('0.00'))
            if valor < Decimal('0.00'):
                errores.append(f"Línea {i+1}: Campo '{campo}' no puede ser negativo: {valor}")
        
        # Validar que la fecha esté presente
        if not linea.get('fecha'):
            advertencias.append(f"Línea {i+1}: Falta fecha del comprobante")
        
        # Validar que el número de comprobante esté presente ("SIN N°" se considera válido)
        numero_chk = linea.get('numero', '').strip()
        if not numero_chk or numero_chk.upper() == 'SIN N°':
            advertencias.append(f"Línea {i+1}: Falta número de comprobante")
    
    return errores, advertencias


def _validar_completitud_datos(datos_libro: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """
    Valida la completitud de los datos del libro IVA.
    """
    
    errores = []
    advertencias = []
    
    if 'lineas' not in datos_libro:
        return errores, advertencias
    
    # Verificar que no haya comprobantes duplicados
    comprobantes_vistos = set()
    for i, linea in enumerate(datos_libro['lineas']):
        # Incluir tipo de comprobante para distinguir facturas de notas de crédito
        clave_comprobante = (
            linea.get('comprobante', ''),  # Tipo de comprobante (ej: "Factura A", "Nota de Crédito B")
            linea.get('numero', '')
        )
        
        if clave_comprobante in comprobantes_vistos:
            errores.append(
                f"Línea {i+1}: Comprobante duplicado {clave_comprobante[0]} - {clave_comprobante[1]}"
            )
        else:
            comprobantes_vistos.add(clave_comprobante)
    
    # Verificar que los datos estén ordenados cronológicamente
    fechas = []
    for linea in datos_libro['lineas']:
        try:
            fecha = datetime.strptime(linea.get('fecha', ''), '%Y-%m-%d').date()
            fechas.append(fecha)
        except ValueError:
            advertencias.append(f"Fecha con formato incorrecto: {linea.get('fecha', '')}")
    
    if len(fechas) > 1:
        fechas_ordenadas = sorted(fechas)
        if fechas != fechas_ordenadas:
            advertencias.append("Los comprobantes no están ordenados cronológicamente")
    
    # Verificar que no haya períodos futuros
    if 'periodo' in datos_libro:
        periodo = datos_libro['periodo']
        fecha_periodo = date(periodo.get('anio', 2024), periodo.get('mes', 1), 1)
        fecha_actual = date.today()
        
        if fecha_periodo > fecha_actual:
            advertencias.append("El período del libro IVA es futuro")
    
    # Verificar que haya al menos una línea con datos
    if not datos_libro['lineas']:
        advertencias.append("El libro IVA no contiene comprobantes para el período seleccionado")
    
    return errores, advertencias


def validar_periodo_libro_iva(mes: int, anio: int) -> Dict[str, List[str]]:
    """
    Valida que el período solicitado para el libro IVA sea válido.
    
    Args:
        mes: Mes del período (1-12)
        anio: Año del período (YYYY)
    
    Returns:
        Dict con errores y advertencias
    """
    
    errores = []
    advertencias = []
    
    # Validar rango de mes
    if not (1 <= mes <= 12):
        errores.append("El mes debe estar entre 1 y 12")
    
    # Validar rango de año
    if not (2020 <= anio <= 2030):
        advertencias.append("El año está fuera del rango esperado (2020-2030)")
    
    # Validar que no sea período futuro
    fecha_actual = date.today()
    fecha_periodo = date(anio, mes, 1)
    
    if fecha_periodo > fecha_actual:
        advertencias.append("No se puede generar libro IVA para períodos futuros")
    
    # Validar que no sea período muy antiguo (más de 5 años)
    fecha_limite = date(fecha_actual.year - 5, fecha_actual.month, fecha_actual.day)
    if fecha_periodo < fecha_limite:
        advertencias.append("El período solicitado es muy antiguo (más de 5 años)")
    
    return {'errores': errores, 'advertencias': advertencias}


def obtener_estadisticas_validacion(datos_libro: Dict[str, Any]) -> Dict[str, Any]:
    """
    Obtiene estadísticas de validación del libro IVA.
    
    Args:
        datos_libro: Datos consolidados del libro IVA
    
    Returns:
        Dict con estadísticas de validación
    """
    
    if 'lineas' not in datos_libro:
        return {
            'total_lineas': 0,
            'lineas_con_errores': 0,
            'lineas_con_advertencias': 0,
            'total_operaciones': Decimal('0.00'),
            'debito_fiscal': Decimal('0.00'),
            'alicuotas_utilizadas': set()
        }
    
    total_lineas = len(datos_libro['lineas'])
    lineas_con_errores = 0
    lineas_con_advertencias = 0
    total_operaciones = Decimal('0.00')
    debito_fiscal = Decimal('0.00')
    alicuotas_utilizadas = set()
    
    for linea in datos_libro['lineas']:
        total_operaciones += linea.get('total', Decimal('0.00'))
        debito_fiscal += (linea.get('iva_21', Decimal('0.00')) + 
                         linea.get('iva_105', Decimal('0.00')) + 
                         linea.get('iva_27', Decimal('0.00')) +
                         linea.get('iva_otras', Decimal('0.00')))
        
        # Detectar alícuotas utilizadas
        if linea.get('iva_21', Decimal('0.00')) > Decimal('0.00'):
            alicuotas_utilizadas.add('21%')
        if linea.get('iva_105', Decimal('0.00')) > Decimal('0.00'):
            alicuotas_utilizadas.add('10.5%')
        if linea.get('iva_27', Decimal('0.00')) > Decimal('0.00'):
            alicuotas_utilizadas.add('27%')
        if linea.get('iva_otras', Decimal('0.00')) > Decimal('0.00'):
            alicuotas_utilizadas.add('Otras')
        if linea.get('importe_exento', Decimal('0.00')) > Decimal('0.00'):
            alicuotas_utilizadas.add('Exentos')
    
    return {
        'total_lineas': total_lineas,
        'lineas_con_errores': lineas_con_errores,
        'lineas_con_advertencias': lineas_con_advertencias,
        'total_operaciones': total_operaciones,
        'debito_fiscal': debito_fiscal,
        'alicuotas_utilizadas': list(alicuotas_utilizadas)
    } 