from rest_framework import serializers

from ..models import Comprobante, Venta


TIPOS_COMPROBANTE_VALIDOS_PARA_NOTAS = {"factura", "factura_interna"}
TIPOS_NOTA_CREDITO = {"nota_credito", "nota_credito_interna"}
TIPOS_NOTA_DEBITO = {"nota_debito", "nota_debito_interna"}
LETRAS_FISCALES = {"A", "B", "C"}


def validar_y_resolver_comprobante_para_nota(
    tipo_comprobante,
    comprobantes_asociados_ids,
):
    if tipo_comprobante not in (TIPOS_NOTA_CREDITO | TIPOS_NOTA_DEBITO):
        return None
    if not comprobantes_asociados_ids:
        return None

    facturas_asociadas = Venta.objects.filter(ven_id__in=comprobantes_asociados_ids)
    if not facturas_asociadas.exists():
        return None

    tipos_asociados = set(facturas_asociadas.values_list("comprobante__tipo", flat=True))
    tipos_invalidos = tipos_asociados - TIPOS_COMPROBANTE_VALIDOS_PARA_NOTAS
    if tipos_invalidos:
        descripcion_nota = "credito" if tipo_comprobante in TIPOS_NOTA_CREDITO else "debito"
        raise serializers.ValidationError(
            {
                "comprobantes_asociados_ids": [
                    (
                        f'No se pueden asociar comprobantes de tipo: {", ".join(sorted(tipos_invalidos))}. '
                        f"Solo se permiten facturas (fiscales o internas) para notas de {descripcion_nota}."
                    )
                ]
            }
        )

    letras_facturas = set(facturas_asociadas.values_list("comprobante__letra", flat=True))
    if len(letras_facturas) > 1:
        raise serializers.ValidationError(
            {
                "comprobantes_asociados_ids": [
                    (
                        "Todas las facturas asociadas deben tener la misma letra. "
                        f'Se encontraron letras: {", ".join(sorted(letras_facturas))}'
                    )
                ]
            }
        )

    letra_facturas = letras_facturas.pop() if letras_facturas else None
    if letra_facturas == "I":
        comprobante_tipo_destino = (
            "nota_credito_interna" if tipo_comprobante in TIPOS_NOTA_CREDITO else "nota_debito_interna"
        )
        mensaje_no_encontrado = (
            "No se encontro comprobante de tipo nota_credito_interna configurado"
            if tipo_comprobante in TIPOS_NOTA_CREDITO
            else "No se encontro comprobante de tipo nota_debito_interna (9994) configurado"
        )
    elif letra_facturas in LETRAS_FISCALES:
        comprobante_tipo_destino = "nota_credito" if tipo_comprobante in TIPOS_NOTA_CREDITO else "nota_debito"
        mensaje_no_encontrado = (
            f"No se encontro comprobante de Nota de Credito {letra_facturas} configurado"
            if tipo_comprobante in TIPOS_NOTA_CREDITO
            else f"No se encontro comprobante de Nota de Debito {letra_facturas} configurado"
        )
    else:
        descripcion_nota = "Credito" if tipo_comprobante in TIPOS_NOTA_CREDITO else "Debito"
        raise serializers.ValidationError(
            {
                "comprobantes_asociados_ids": [
                    f"Letra de factura no soportada para Notas de {descripcion_nota}: {letra_facturas}"
                ]
            }
        )

    try:
        comprobante = Comprobante.objects.get(
            tipo=comprobante_tipo_destino,
            letra=letra_facturas,
        )
    except Comprobante.DoesNotExist as exc:
        raise serializers.ValidationError(
            {"tipo_comprobante": [mensaje_no_encontrado]}
        ) from exc

    return comprobante.codigo_afip
