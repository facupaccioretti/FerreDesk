import copy
from decimal import Decimal, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from ferreapps.caja.utils import normalizar_cobro, registrar_pagos_venta, registrar_vuelto
from ferreapps.clientes.models import Cliente
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.ARCA import emitir_arca_automatico, debe_emitir_arca
from ferreapps.ventas.ARCA.settings_arca import COMPROBANTES_INTERNOS
from ferreapps.ventas.models import Comprobante, Venta
from ferreapps.ventas.serializers import VentaSerializer
from ferreapps.ventas.utils import asignar_comprobante, _construir_respuesta_comprobante


PUNTO_VENTA_INTERNO = 99


def calcular_ajuste_nota_credito(items, items_preview, total_objetivo):
    """Calcula el residuo necesario para conservar centavos entre devoluciones."""
    total_lineas = Decimal("0.00")
    for item, item_preview in zip(items, items_preview):
        cantidad = Decimal(str(item["vdi_cantidad"]))
        precio = Decimal(str(item_preview["precio_unitario_origen"]))
        total_lineas += (cantidad * precio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return Decimal(str(total_objetivo)) - total_lineas


def obtener_total_documento_persistido(venta):
    venta_calculada = Venta.objects.con_calculos().filter(pk=venta.pk).first()
    if venta_calculada is None:
        raise ValidationError({"venta": "No se encontro el documento creado"})
    return venta_calculada.ven_total


def crear_documento_venta_desde_payload(
    *,
    payload,
    usuario,
    sesion_caja=None,
    permitir_registrar_pagos=False,
    origen_postventa=False,
):
    data = copy.deepcopy(payload)
    tipo_comprobante = data.get("tipo_comprobante")
    if not tipo_comprobante:
        raise ValidationError({"tipo_comprobante": "Debe indicar el tipo de comprobante"})

    comprobante_id = data.get("comprobante_id")
    if comprobante_id:
        comprobante_obj = Comprobante.objects.filter(codigo_afip=comprobante_id, activo=True).first()
        if comprobante_obj is None:
            raise ValidationError({"comprobante_id": "Comprobante inexistente o inactivo"})
        comprobante = _construir_respuesta_comprobante(comprobante_obj)
    else:
        ferreteria = Ferreteria.objects.first()
        cliente = Cliente.objects.filter(id=data.get("ven_idcli")).first()
        tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else "").strip().lower()
        try:
            comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
        except Exception as exc:
            raise ValidationError({"tipo_comprobante": str(exc)}) from exc
        if not comprobante:
            raise ValidationError({"tipo_comprobante": "No se encontro comprobante valido"})
        data["comprobante_id"] = comprobante["codigo_afip"]
        if tipo_comprobante in COMPROBANTES_INTERNOS:
            data["ven_punto"] = PUNTO_VENTA_INTERNO
        if debe_emitir_arca(tipo_comprobante) and ferreteria and getattr(ferreteria, "punto_venta_arca", None):
            data["ven_punto"] = ferreteria.punto_venta_arca

    if tipo_comprobante in COMPROBANTES_INTERNOS:
        data["ven_punto"] = PUNTO_VENTA_INTERNO

    punto_venta = data.get("ven_punto")
    if not punto_venta:
        raise ValidationError({"ven_punto": "El punto de venta es requerido"})

    intentos = 0
    while intentos < 10:
        ultima_venta = (
            Venta.objects.filter(ven_punto=punto_venta, comprobante_id=data["comprobante_id"])
            .order_by("-ven_numero")
            .first()
        )
        data["ven_numero"] = 1 if ultima_venta is None else ultima_venta.ven_numero + 1
        serializer = VentaSerializer(data=data, context={"origen_postventa": origen_postventa})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                venta = serializer.save()
            break
        except IntegrityError as exc:
            if "unique" not in str(exc).lower() and "duplicate" not in str(exc).lower():
                raise
            intentos += 1
    else:
        raise ValidationError({"detail": "No se pudo asignar un numero de comprobante unico"})

    if sesion_caja is not None:
        venta.sesion_caja = sesion_caja
        venta.save(update_fields=["sesion_caja"])

    if debe_emitir_arca(tipo_comprobante):
        emitir_arca_automatico(venta)

    pagos_creados = []
    if permitir_registrar_pagos and data.get("comprobante_pagado"):
        venta_con_totales = Venta.objects.con_calculos().filter(pk=venta.pk).first() or venta
        pagos_normalizados, metadata_cobro = normalizar_cobro(
            {
                "pagos": list(data.get("pagos") or []),
                "monto_pago": data.get("monto_pago", 0),
                "excedente_destino": data.get("excedente_destino"),
                "justificacion_excedente": data.get("justificacion_excedente"),
            },
            venta_con_totales.ven_total,
        )
        if pagos_normalizados:
            pagos_creados = registrar_pagos_venta(
                venta=venta,
                sesion_caja=sesion_caja,
                pagos=pagos_normalizados,
                descripcion_base="Pago de",
            )
        excedente_destino = (data.get("excedente_destino") or "").strip().lower()
        monto_excedente = metadata_cobro.get("vuelto_calculado") or 0
        if excedente_destino == "vuelto" and monto_excedente:
            registrar_vuelto(venta=venta, sesion_caja=sesion_caja, monto_vuelto=monto_excedente)

    return venta, pagos_creados
