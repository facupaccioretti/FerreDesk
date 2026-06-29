from django.db import models

from ..models import VentaDetalleItem


def preparar_item_venta_para_persistencia(item_data, venta=None, orden=None):
    campos_calculados = ["vdi_importe", "vdi_importe_total", "vdi_ivaitem"]
    for campo in campos_calculados:
        item_data.pop(campo, None)

    if venta is not None:
        item_data["vdi_idve"] = venta
    if orden is not None:
        item_data["vdi_orden"] = orden

    for fk_field in ["vdi_idsto", "vdi_idpro", "vdi_idaliiva"]:
        if fk_field in item_data and not isinstance(item_data[fk_field], models.Model):
            val = item_data.pop(fk_field)
            if val is not None:
                item_data[f"{fk_field}_id"] = val

    return item_data


def crear_items_venta(venta, items_data):
    for orden, item_data in enumerate(items_data, 1):
        preparar_item_venta_para_persistencia(
            item_data,
            venta=venta,
            orden=orden,
        )
        VentaDetalleItem.objects.create(**item_data)


def actualizar_items_venta_inteligente(instance, items_data):
    """Actualiza items existentes, crea nuevos y elimina los removidos."""
    # Indexa los items existentes por ID para resolver update/delete rapido.
    items_existentes = {item.id: item for item in instance.items.all()}

    # Solo cuentan los IDs explicitamente enviados en el payload.
    ids_enviados = {item.get("id") for item in items_data if item.get("id")}

    # Elimina items ausentes en el payload final.
    for item_id, item in items_existentes.items():
        if item_id not in ids_enviados:
            item.delete()

    # Recorre el payload final y decide create o update por item.
    for i, item_data in enumerate(items_data, 1):
        preparar_item_venta_para_persistencia(item_data, venta=instance, orden=i)

        item_id = item_data.pop("id", None)

        if item_id and item_id in items_existentes:
            item = items_existentes[item_id]
            for field, value in item_data.items():
                if field in ("vdi_idsto", "vdi_idpro", "vdi_idaliiva") and not isinstance(value, models.Model) and value is not None:
                    setattr(item, f"{field}_id", value)
                else:
                    setattr(item, field, value)
                item.save()
        else:
            VentaDetalleItem.objects.create(**item_data)
