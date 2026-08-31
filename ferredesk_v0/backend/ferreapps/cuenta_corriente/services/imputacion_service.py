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

    origen_ct = ContentType.objects.get_for_model(comprobante_pago)
    destinos = {}
    for item in facturas_a_imputar:
        factura = item["factura"]
        monto = Decimal(str(item["monto"]))
        if monto <= 0:
            raise ValueError(f"El monto a imputar debe ser mayor a cero, recibido: {monto}")

        destino_ct = ContentType.objects.get_for_model(factura)
        clave = (destino_ct.pk, factura.pk)
        observacion = item.get("observacion", "")
        destino = destinos.setdefault(
            clave,
            {"factura": factura, "monto": Decimal("0.00"), "ct": destino_ct, "observacion": observacion},
        )
        if destino["observacion"] != observacion:
            raise ValueError(f"El documento {factura.pk} esta repetido con observaciones distintas")
        destino["monto"] += monto

    with transaction.atomic():
        _bloquear_documentos([comprobante_pago, *(destino["factura"] for destino in destinos.values())])
        _validar_origen_venta(comprobante_pago, origen_ct, destinos.values())

        if validar_cliente:
            entidad_pago = _get_entidad(comprobante_pago)
            for destino in destinos.values():
                entidad_factura = _get_entidad(destino["factura"])
                if entidad_factura.id != entidad_pago.id:
                    raise ValueError(
                        f"El documento {destino['factura'].pk} no pertenece a la misma "
                        f"entidad que el comprobante de pago"
                    )

        if idempotency_key:
            imputaciones_existentes = list(
                Imputacion.objects.filter(
                    origen_content_type=origen_ct,
                    origen_id=comprobante_pago.pk,
                    imp_idempotency_key=idempotency_key,
                )
            )
            if imputaciones_existentes:
                _validar_reintento_idempotente(imputaciones_existentes, destinos)
                return imputaciones_existentes

        pendientes = []
        for destino in destinos.values():
            factura = destino["factura"]
            monto = destino["monto"]
            destino_ct = destino["ct"]
            observacion = destino["observacion"]
            pendientes.append((factura, monto, destino_ct, observacion))

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
                imp_idempotency_key=idempotency_key,
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
    total_devuelto = Decimal("0.00")
    if hasattr(comprobante_pago, "comprobante"):
        from ferreapps.caja.models import PagoVenta

        total_devuelto = (
            PagoVenta.objects.filter(
                venta_id=comprobante_pago.pk,
                tipo_operacion=PagoVenta.TIPO_DEVOLUCION_CLIENTE,
            ).aggregate(total=Sum("monto"))["total"]
            or Decimal("0.00")
        )
    saldo_disponible = total_comprobante - total_imputado - total_devuelto

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
    for modelo in sorted(modelos, key=lambda item: item._meta.label_lower):
        list(modelo.objects.select_for_update().filter(pk__in=sorted(modelos[modelo])).order_by("pk"))


def _validar_reintento_idempotente(imputaciones, destinos):
    esperadas = {
        (destino["ct"].pk, destino["factura"].pk): destino["monto"]
        for destino in destinos.values()
    }
    existentes = {
        (imputacion.destino_content_type_id, imputacion.destino_id): imputacion.imp_monto
        for imputacion in imputaciones
    }
    if existentes != esperadas:
        raise ValueError("La clave de idempotencia ya fue usada con una intencion distinta")


def _validar_origen_venta(comprobante_pago: Model, origen_ct, destinos):
    if not hasattr(comprobante_pago, "comprobante"):
        return
    comprobante = comprobante_pago.comprobante
    if comprobante is None or comprobante.tipo not in {
        "factura", "factura_interna", "nota_debito", "nota_debito_interna",
    }:
        return
    if any(destino["ct"] != origen_ct or destino["factura"].pk != comprobante_pago.pk for destino in destinos):
        raise ValueError("Una factura solo puede autoimputarse a si misma")


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
