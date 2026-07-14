"""
Servicio unificado de imputacion para gestion de deudas.
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Model, Sum
from django.utils import timezone

from ..models import Imputacion


def imputar_deuda(
    comprobante_pago: Model,
    facturas_a_imputar: List[Dict[str, Any]],
    validar_cliente: bool = True,
    idempotency_key: Optional[str] = None,
) -> List[Imputacion]:
    imputaciones_creadas = []
    fecha_imputacion = timezone.now().date()

    if not facturas_a_imputar:
        return []

    with transaction.atomic():
        _bloquear_documentos([comprobante_pago])
        _bloquear_documentos([item["factura"] for item in facturas_a_imputar])

        origen_ct = ContentType.objects.get_for_model(comprobante_pago)

        if validar_cliente:
            entidad_pago = _get_entidad(comprobante_pago)
            for item in facturas_a_imputar:
                entidad_factura = _get_entidad(item["factura"])
                if entidad_factura.id != entidad_pago.id:
                    raise ValueError(
                        f"El documento {item['factura'].pk} no pertenece a la misma "
                        f"entidad que el comprobante de pago"
                    )

        pendientes = []
        for item in facturas_a_imputar:
            factura = item["factura"]
            monto = Decimal(str(item["monto"]))
            destino_ct = ContentType.objects.get_for_model(factura)
            observacion = item.get("observacion", "")
            observacion_final = f"{observacion} [{idempotency_key}]".strip() if idempotency_key else observacion

            if idempotency_key:
                imputacion_existente = Imputacion.objects.filter(
                    origen_content_type=origen_ct,
                    origen_id=comprobante_pago.pk,
                    destino_content_type=destino_ct,
                    destino_id=factura.pk,
                    imp_observacion=observacion_final,
                ).first()
                if imputacion_existente:
                    imputaciones_creadas.append(imputacion_existente)
                    continue

            if monto <= 0:
                raise ValueError(f"El monto a imputar debe ser mayor a cero, recibido: {monto}")

            pendientes.append((factura, monto, destino_ct, observacion_final))

        if not pendientes:
            return imputaciones_creadas

        total_lote = sum(monto for _, monto, _, _ in pendientes)
        validar_saldo_comprobante_pago(comprobante_pago, total_lote)

        for factura, monto, destino_ct, _ in pendientes:
            imputaciones_existentes = Imputacion.objects.filter(
                destino_content_type=destino_ct,
                destino_id=factura.pk,
            ).aggregate(total=Sum("imp_monto"))
            total_imputado = imputaciones_existentes["total"] or Decimal("0.00")
            total_documento = _get_total_documento(factura)
            saldo_pendiente = total_documento - total_imputado
            if monto > saldo_pendiente:
                raise ValueError(
                    f"El monto a imputar (${monto}) excede el saldo pendiente "
                    f"del documento (${saldo_pendiente})"
                )

        for factura, monto, destino_ct, observacion_final in pendientes:
            if not idempotency_key:
                imputacion_existente = Imputacion.objects.filter(
                    origen_content_type=origen_ct,
                    origen_id=comprobante_pago.pk,
                    destino_content_type=destino_ct,
                    destino_id=factura.pk,
                    imp_fecha=fecha_imputacion,
                ).first()
                if imputacion_existente:
                    imputacion_existente.imp_monto += monto
                    imputacion_existente.save(update_fields=["imp_monto"])
                    imputaciones_creadas.append(imputacion_existente)
                    continue

            imputacion = Imputacion.objects.create(
                origen_content_type=origen_ct,
                origen_id=comprobante_pago.pk,
                destino_content_type=destino_ct,
                destino_id=factura.pk,
                imp_fecha=fecha_imputacion,
                imp_monto=monto,
                imp_observacion=observacion_final,
            )
            imputaciones_creadas.append(imputacion)

    return imputaciones_creadas


def validar_saldo_comprobante_pago(
    comprobante_pago: Model,
    monto_a_imputar: Decimal,
) -> Decimal:
    total_comprobante = _get_total_documento(comprobante_pago)
    origen_ct = ContentType.objects.get_for_model(comprobante_pago)
    imputaciones_existentes = Imputacion.objects.filter(
        origen_content_type=origen_ct,
        origen_id=comprobante_pago.pk,
    ).aggregate(total=Sum("imp_monto"))
    total_imputado = imputaciones_existentes["total"] or Decimal("0.00")
    saldo_disponible = total_comprobante - total_imputado

    if monto_a_imputar > saldo_disponible:
        raise ValueError(
            f"El monto a imputar (${monto_a_imputar}) excede el saldo disponible "
            f"del comprobante (${saldo_disponible})"
        )

    return saldo_disponible


def _bloquear_documentos(documentos: List[Model]):
    modelos = {}
    for documento in documentos:
        modelos.setdefault(documento.__class__, set()).add(documento.pk)
    for modelo, ids in modelos.items():
        list(modelo.objects.select_for_update().filter(pk__in=ids))


def _get_entidad(obj: Model):
    if hasattr(obj, "ven_idcli"):
        return obj.ven_idcli
    if hasattr(obj, "rec_cliente"):
        return obj.rec_cliente
    if hasattr(obj, "op_proveedor"):
        return obj.op_proveedor
    if hasattr(obj, "comp_idpro"):
        return obj.comp_idpro
    if hasattr(obj, "aj_proveedor"):
        return obj.aj_proveedor
    raise ValueError(f"No se pudo determinar la entidad para {obj}")


def _get_total_documento(obj: Model) -> Decimal:
    if hasattr(obj, "ven_total"):
        return Decimal(str(obj.ven_total))
    if hasattr(obj, "rec_total"):
        return Decimal(str(obj.rec_total))
    if hasattr(obj, "op_total"):
        return Decimal(str(obj.op_total))
    if hasattr(obj, "comp_total_final"):
        return Decimal(str(obj.comp_total_final))
    if hasattr(obj, "aj_monto"):
        return Decimal(str(obj.aj_monto))
    raise ValueError(f"No se pudo determinar el total para {obj}")
