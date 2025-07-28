from django.core.exceptions import ValidationError
from ferreapps.ventas.models import Comprobante
from ferreapps.clientes.models import TipoIVA
from ferreapps.productos.models import Ferreteria

def normalizar_situacion_iva(valor):
    # Si es un número (ID), buscar el nombre en TipoIVA
    if isinstance(valor, int) or (isinstance(valor, str) and valor.isdigit()):
        try:
            tipo_iva = TipoIVA.objects.get(id=int(valor))
            valor = tipo_iva.nombre
        except TipoIVA.DoesNotExist:
            valor = ''
    valor = (valor or '').strip().lower()
    # Acepta tanto los códigos cortos como los nombres largos
    if valor in ["ri", "responsable inscripto", "responsable inscripto"]:
        return "responsable_inscripto"
    if valor in ["mo", "responsable monotributo", "monotributo social", "responsable monotributo"]:
        return "monotributista"
    if valor in ["iva sujeto exento", "exento", "sujeto exento"]:
        return "exento"
    if valor in ["consumidor final"]:
        return "consumidor_final"
    if valor in ["responsable no inscripto"]:
        return "responsable_no_inscripto"
    return valor

def _construir_respuesta_comprobante(comprobante):
    """
    Función auxiliar para construir un diccionario con la información del comprobante.
    """
    if not comprobante:
        return None
        
    letra = comprobante.letra or ''
    return {
        "id": comprobante.id,
        "activo": comprobante.activo,
        "codigo_afip": comprobante.codigo_afip,
        "descripcion": comprobante.descripcion,
        "letra": letra,
        "tipo": comprobante.tipo,
        "nombre": comprobante.nombre,
        "requisitos": get_requisitos_por_letra(letra)
    }

def _aplicar_logica_fiscal(comprobantes, situacion_iva_cliente):
    """
    Aplica la lógica fiscal para determinar qué letra de comprobante corresponde
    según la situación fiscal del emisor y del cliente.
    """
    ferreteria = Ferreteria.objects.first()
    if not ferreteria or not ferreteria.situacion_iva:
        raise ValidationError("No se encontró configuración fiscal de la ferretería")
        
    situacion_iva_ferreteria = ferreteria.situacion_iva
    emisor = normalizar_situacion_iva(situacion_iva_ferreteria)
    cliente = normalizar_situacion_iva(situacion_iva_cliente)
    
    # Determinar la letra según las reglas fiscales
    if emisor == 'responsable_inscripto':
        if cliente == 'responsable_inscripto':
            letra_objetivo = 'A'
        else:
            letra_objetivo = 'B'
    elif emisor == 'monotributista':
        letra_objetivo = 'C'
    else:
        raise ValidationError(f"Situación fiscal de la ferretería no reconocida: {emisor}")

    # Buscar el comprobante con la letra determinada
    comprobante = comprobantes.filter(letra=letra_objetivo).first()
    if not comprobante:
        raise ValidationError(
            f"No se encontró comprobante activo con letra '{letra_objetivo}'. "
            f"Verifique la configuración de comprobantes para situación IVA cliente: {cliente}"
        )
    
    return comprobante

def asignar_comprobante(tipo_comprobante, situacion_iva_cliente):
    """
    Asigna el comprobante correcto según el tipo y la situación IVA del cliente.
    
    Lógica:
    1. Si hay un solo comprobante del tipo: lo devuelve directamente (sin lógica fiscal)
    2. Si hay múltiples comprobantes del tipo: aplica lógica fiscal para determinar letra A/B/C
    """
    # Validación de parámetros
    if not tipo_comprobante:
        raise ValidationError("El tipo de comprobante no puede estar vacío")
    
    # Buscar comprobantes activos del tipo especificado
    comprobantes = Comprobante.objects.filter(activo=True, tipo=tipo_comprobante)
    
    # Si no hay comprobantes activos del tipo, lanzar error
    if not comprobantes.exists():
        raise ValidationError(f"No hay comprobantes activos para el tipo '{tipo_comprobante}'.")

    # Si solo hay un comprobante de este tipo, devolverlo directamente
    # (presupuesto, factura_interna, nota_credito_interna, etc.)
    if comprobantes.count() == 1:
        return _construir_respuesta_comprobante(comprobantes.first())
    
    # Si hay múltiples comprobantes del mismo tipo, aplicar lógica fiscal
    # (facturas A/B/C, notas de crédito A/B/C, etc.)
    comprobante = _aplicar_logica_fiscal(comprobantes, situacion_iva_cliente)
    return _construir_respuesta_comprobante(comprobante)

def get_requisitos_por_letra(letra):
    letra = (letra or '').upper()
    
    # Diccionario central con todos los requisitos por letra
    requisitos_por_letra = {
        'A': {
            'cuit_obligatorio': True,
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Factura A (Responsables inscriptos en IVA): CUIT y condición frente al IVA obligatorios.'
        },
        'B': {
            'cuit_obligatorio': True,
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Factura B (Monotributistas y otros no inscriptos en IVA): CUIT y condición frente al IVA obligatorios.'
        },
        'C': {
            'cuit_obligatorio': True,  # Por ahora, hasta que se agregue opción de otros documentos
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': True,
            'documento_obligatorio': True,
            'mensaje': 'Factura C (Consumidor final): Nombre y apellido o razón social, número de documento y condición frente al IVA obligatorios.'
        },
        'X': {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Comprobante en negro: mínimos requisitos.'
        },
        'V': {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Comprobante en negro: mínimos requisitos.'
        },
        'P': {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': True,
            'documento_obligatorio': False,
            'mensaje': 'Presupuesto: solo requiere nombre o razón social.'
        },
        'I': {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': True,
            'documento_obligatorio': False,
            'mensaje': 'Factura Interna: solo requiere nombre o razón social.'
        },
        'NC': {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': True,
            'documento_obligatorio': False,
            'mensaje': 'Nota de Crédito Interna: solo requiere nombre o razón social.'
        }
    }
    
    # Si la letra existe en el diccionario, devolver esos requisitos
    if letra in requisitos_por_letra:
        return requisitos_por_letra[letra]
    
    # Para letras no definidas, usar un conjunto de requisitos por defecto
    return {
        'cuit_obligatorio': False,
        'condicion_iva_obligatoria': False,
        'nombre_obligatorio': True,
        'documento_obligatorio': False,
        'mensaje': f'Comprobante {letra}: requiere al menos nombre o razón social.'
    }