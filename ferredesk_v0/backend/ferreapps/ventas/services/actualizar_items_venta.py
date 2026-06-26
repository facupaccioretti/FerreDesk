from django.db import models

from ..models import VentaDetalleItem


def actualizar_items_venta_inteligente(instance, items_data):
    """Actualizar items de venta de manera inteligente: actualizar existentes, crear nuevos, eliminar removidos"""
    # Obtener items existentes
    items_existentes = {item.id: item for item in instance.items.all()}

    # Obtener IDs de items enviados (solo los que tienen ID)
    ids_enviados = {item.get('id') for item in items_data if item.get('id')}

    # Eliminar items que ya no estÃ¡n en la lista enviada
    for item_id, item in items_existentes.items():
        if item_id not in ids_enviados:
            item.delete()

    # Procesar items enviados
    for i, item_data in enumerate(items_data, 1):
        # Limpiar campos calculados que no deben guardarse
        campos_calculados = ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']
        for campo in campos_calculados:
            item_data.pop(campo, None)

        # Establecer relaciÃ³n con la venta y orden
        item_data['vdi_idve'] = instance
        item_data['vdi_orden'] = i

        # Determinar si es actualizaciÃ³n o creaciÃ³n
        item_id = item_data.pop('id', None)

        if item_id and item_id in items_existentes:
            # Actualizar item existente
            item = items_existentes[item_id]
            for field, value in item_data.items():
                # Para campos FK, usar la forma _id si el valor es numÃ©rico
                if field in ('vdi_idsto', 'vdi_idpro', 'vdi_idaliiva') and not isinstance(value, models.Model) and value is not None:
                    setattr(item, f'{field}_id', value)
                else:
                    setattr(item, field, value)
            item.save()
        else:
            # Crear nuevo item â€” normalizar FK a forma _id
            for fk_field in ['vdi_idsto', 'vdi_idpro', 'vdi_idaliiva']:
                if fk_field in item_data and not isinstance(item_data[fk_field], models.Model):
                    val = item_data.pop(fk_field)
                    if val is not None:
                        item_data[f'{fk_field}_id'] = val
            VentaDetalleItem.objects.create(**item_data)
