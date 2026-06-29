"""Selectores de lectura para la app de ventas."""

from .venta_relaciones import (
    obtener_cliente_nombre_venta,
    serializar_facturas_anuladas,
    serializar_notas_credito_que_anulan,
)

__all__ = [
    "obtener_cliente_nombre_venta",
    "serializar_facturas_anuladas",
    "serializar_notas_credito_que_anulan",
]
