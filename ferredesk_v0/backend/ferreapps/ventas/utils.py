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
    if valor in ["ri", "responsable inscripto"]:
        return "responsable_inscripto"
    if valor in ["mo", "responsable monotributo", "monotributo social"]:
        return "monotributista"
    if valor in ["iva sujeto exento", "exento"]:
        return "exento"
    if valor in ["consumidor final"]:
        return "consumidor_final"
    return valor

def asignar_comprobante(tipo_comprobante, situacion_iva_cliente):
    comprobantes = Comprobante.objects.filter(activo=True, tipo=tipo_comprobante)
    if not comprobantes.exists():
        raise ValidationError(f"No hay comprobantes activos para el tipo '{tipo_comprobante}'.")

    requiere_logica_fiscal = comprobantes.count() > 1

    if not requiere_logica_fiscal:
        comprobante = comprobantes.first()
        letra = comprobante.letra
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

    ferreteria = Ferreteria.objects.first()
    situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
    emisor = normalizar_situacion_iva(situacion_iva_ferreteria)
    cliente = normalizar_situacion_iva(situacion_iva_cliente)

    if tipo_comprobante == 'recibo':
        letra_objetivo = 'X'
    elif emisor == 'responsable_inscripto':
        if cliente == 'responsable_inscripto':
            letra_objetivo = 'A'
        else:
            letra_objetivo = 'B'
    elif emisor == 'monotributista':
        letra_objetivo = 'C'
    else:
        raise ValidationError("Situación fiscal de la ferretería no reconocida")

    comprobante = comprobantes.filter(letra=letra_objetivo).first()
    if not comprobante:
        raise ValidationError(
            f"No se encontró comprobante activo tipo '{tipo_comprobante}' con letra '{letra_objetivo}'."
        )

    return {
        "id": comprobante.id,
        "activo": comprobante.activo,
        "codigo_afip": comprobante.codigo_afip,
        "descripcion": comprobante.descripcion,
        "letra": comprobante.letra,
        "tipo": comprobante.tipo,
        "nombre": comprobante.nombre,
        "requisitos": get_requisitos_por_letra(comprobante.letra)
    }

def get_requisitos_por_letra(letra):
    letra = (letra or '').upper()
    if letra == 'A':
        return {
            'cuit_obligatorio': True,
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Factura A (Responsables inscriptos en IVA): CUIT y condición frente al IVA obligatorios.'
        }
    if letra == 'B':
        return {
            'cuit_obligatorio': True,
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Factura B (Monotributistas y otros no inscriptos en IVA): CUIT y condición frente al IVA obligatorios.'
        }
    if letra == 'C':
        return {
            'cuit_obligatorio': True,  # Por ahora, hasta que se agregue opción de otros documentos
            'condicion_iva_obligatoria': True,
            'nombre_obligatorio': True,
            'documento_obligatorio': True,
            'mensaje': 'Factura C (Consumidor final): Nombre y apellido o razón social, número de documento y condición frente al IVA obligatorios.'
        }
    if letra == 'X' or letra == 'V':
        return {
            'cuit_obligatorio': False,
            'condicion_iva_obligatoria': False,
            'nombre_obligatorio': False,
            'documento_obligatorio': False,
            'mensaje': 'Comprobante en negro: mínimos requisitos.'
        }
    return {}