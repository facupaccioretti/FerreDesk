from django.core.exceptions import ValidationError
from ferreapps.ventas.models import Comprobante

def normalizar_situacion_iva(valor):
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

def asignar_comprobante(tipo_comprobante, situacion_iva_ferreteria, situacion_iva_cliente):
    comprobantes = Comprobante.objects.filter(activo=True, tipo=tipo_comprobante)
    if not comprobantes.exists():
        raise ValidationError(f"No hay comprobantes activos para el tipo '{tipo_comprobante}'.")

    requiere_logica_fiscal = comprobantes.count() > 1

    if not requiere_logica_fiscal:
        # Si no requiere lógica fiscal, devolver el único comprobante
        comprobante = comprobantes.first()
        return {
            "id": comprobante.id,
            "activo": comprobante.activo,
            "codigo_afip": comprobante.codigo_afip,
            "descripcion": comprobante.descripcion,
            "letra": comprobante.letra,
            "tipo": comprobante.tipo,
            "nombre": comprobante.nombre,
        }

    # Normalizar situaciones fiscales
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
    }