"""Helpers de lectura para relaciones y etiquetas derivadas de ventas."""

from ferreapps.clientes.models import Cliente

from ..models import ComprobanteAsociacion


def obtener_cliente_nombre_venta(venta):
    """Devuelve el nombre del cliente con compatibilidad para datos legacy."""
    try:
        if hasattr(venta.ven_idcli, "razon"):
            return venta.ven_idcli.razon if hasattr(venta.ven_idcli, "razon") else str(venta.ven_idcli)
        cliente = Cliente.objects.get(id=venta.ven_idcli)
        return cliente.razon if hasattr(cliente, "razon") else str(cliente)
    except (Cliente.DoesNotExist, AttributeError):
        return ""


def serializar_notas_credito_que_anulan(venta, serializer_class, context):
    """Serializa las notas de credito asociadas a una factura."""
    asociaciones = ComprobanteAsociacion.objects.filter(factura_afectada_id=venta.ven_id)
    notas_credito = [asc.nota_credito for asc in asociaciones]
    return serializer_class(notas_credito, many=True, context=context).data


def serializar_facturas_anuladas(venta, serializer_class, context):
    """Serializa las facturas afectadas por una nota de credito."""
    asociaciones = ComprobanteAsociacion.objects.filter(nota_credito_id=venta.ven_id)
    facturas = [asc.factura_afectada for asc in asociaciones]
    return serializer_class(facturas, many=True, context=context).data
