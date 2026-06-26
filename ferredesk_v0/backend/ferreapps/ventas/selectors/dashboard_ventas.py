from datetime import timedelta

from django.db.models import Count, F, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from ferreapps.ventas.models import Venta, VentaDetalleItem


def _chart_payload(label, data, *, background_color=None, border_color=None, extra=None):
    dataset = {
        "label": label,
        "data": data,
    }
    if background_color is not None:
        dataset["backgroundColor"] = background_color
    if border_color is not None:
        dataset["borderColor"] = border_color
    if extra:
        dataset.update(extra)
    return {"labels": [], "datasets": [dataset]}


def obtener_productos_mas_vendidos(tipo="cantidad"):
    if tipo == "cantidad":
        results = (
            VentaDetalleItem.objects.con_calculos()
            .filter(vdi_cantidad__gt=0)
            .values(producto=Coalesce(F("vdi_detalle1"), Value("Producto sin nombre")))
            .annotate(total=Sum("vdi_cantidad"))
            .order_by("-total")[:10]
        )
        label = "Cantidad Vendida"
    else:
        results = (
            VentaDetalleItem.objects.con_calculos()
            .filter(total_item__gt=0)
            .values(producto=Coalesce(F("vdi_detalle1"), Value("Producto sin nombre")))
            .annotate(total=Sum("total_item"))
            .order_by("-total")[:10]
        )
        label = "Total Facturado ($)"

    payload = _chart_payload(
        label,
        [],
        background_color="rgba(59, 130, 246, 0.8)",
        border_color="rgba(59, 130, 246, 1)",
        extra={"borderWidth": 1, "borderRadius": 4},
    )
    payload["labels"] = [row["producto"] for row in results]
    payload["datasets"][0]["data"] = [float(row["total"]) for row in results]
    return payload


def obtener_ventas_por_dia(periodo="7d"):
    hoy = timezone.now().date()
    deltas = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    fecha_inicio = hoy - timedelta(days=deltas.get(periodo, 7))

    results = (
        Venta.objects.con_calculos()
        .filter(ven_fecha__range=[fecha_inicio, hoy])
        .annotate(fecha_dia=TruncDate("ven_fecha"))
        .values("fecha_dia")
        .annotate(total_ventas=Sum("_ven_total"))
        .order_by("fecha_dia")
    )

    payload = _chart_payload(
        "Ventas Diarias ($)",
        [],
        background_color="rgba(34, 197, 94, 0.1)",
        border_color="rgba(34, 197, 94, 1)",
        extra={
            "borderWidth": 3,
            "fill": True,
            "tension": 0.4,
            "pointBackgroundColor": "rgba(34, 197, 94, 1)",
            "pointBorderColor": "#ffffff",
            "pointBorderWidth": 2,
            "pointRadius": 6,
            "pointHoverRadius": 8,
        },
    )
    payload["labels"] = [row["fecha_dia"].strftime("%d/%m") for row in results]
    payload["datasets"][0]["data"] = [float(row["total_ventas"]) for row in results]
    return payload


def obtener_clientes_mas_ventas(tipo="total"):
    if tipo == "total":
        results = (
            Venta.objects.con_calculos()
            .filter(_ven_total__gt=0)
            .values(cliente=Coalesce(F("cliente_razon"), Value("Consumidor Final")))
            .annotate(total=Sum("_ven_total"))
            .order_by("-total")[:10]
        )
        label = "Total Facturado ($)"
    elif tipo == "cantidad":
        results = (
            VentaDetalleItem.objects.con_calculos()
            .filter(vdi_cantidad__gt=0)
            .values(cliente=Coalesce(F("vdi_idve__ven_idcli__razon"), Value("Consumidor Final")))
            .annotate(total=Sum("vdi_cantidad"))
            .order_by("-total")[:10]
        )
        label = "Cantidad de Productos"
    else:
        results = (
            Venta.objects.con_calculos()
            .filter(_ven_total__gt=0)
            .values(cliente=Coalesce(F("cliente_razon"), Value("Consumidor Final")))
            .annotate(total=Count("ven_id"))
            .order_by("-total")[:10]
        )
        label = "Frecuencia de Compras"

    payload = _chart_payload(
        label,
        [],
        background_color="rgba(168, 85, 247, 0.8)",
        border_color="rgba(168, 85, 247, 1)",
        extra={"borderWidth": 1, "borderRadius": 4},
    )
    payload["labels"] = [row["cliente"] for row in results]
    payload["datasets"][0]["data"] = [float(row["total"]) for row in results]
    return payload

