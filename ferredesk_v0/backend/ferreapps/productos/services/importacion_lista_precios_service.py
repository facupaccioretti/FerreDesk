import os
import re
from decimal import Decimal

import pyexcel as pe
from django.db import transaction
from django.utils import timezone

from ferreapps.productos.models import PrecioProveedorExcel, StockProve
from ferreapps.proveedores.models import HistorialImportacionProveedor


def normalizar_codigo_proveedor(texto):
    if texto is None:
        return ""
    if isinstance(texto, int):
        s = str(texto)
    elif isinstance(texto, float):
        s = str(int(texto)) if float(texto).is_integer() else str(texto)
    elif isinstance(texto, Decimal):
        s = str(int(texto)) if texto == texto.to_integral_value() else str(texto)
    else:
        s = str(texto)
    s = s.strip()
    if re.fullmatch(r"\d+\.0+", s):
        s = s.split(".", 1)[0]
    s = re.sub(r"\s+", " ", s)
    return s[:100]


def importar_lista_precios_proveedor(
    *,
    proveedor,
    excel_file,
    col_codigo="A",
    col_precio="B",
    col_denominacion="C",
    fila_inicio=2,
):
    filename = excel_file.name
    ext = os.path.splitext(filename)[1].lower().replace(".", "")
    sheet = pe.get_sheet(file_type=ext, file_content=excel_file.read())

    PrecioProveedorExcel.objects.filter(proveedor=proveedor).delete()

    to_create = []
    col_codigo_idx = ord(col_codigo.upper()) - 65
    col_precio_idx = ord(col_precio.upper()) - 65
    col_denominacion_idx = ord(col_denominacion.upper()) - 65
    max_len_denominacion = (
        PrecioProveedorExcel._meta.get_field("denominacion").max_length or 200
    )

    for i, row in enumerate(sheet.rows()):
        if i + 1 < fila_inicio:
            continue
        try:
            codigo = row[col_codigo_idx]
            precio = row[col_precio_idx]
            denominacion = row[col_denominacion_idx] if col_denominacion_idx < len(row) else None
        except IndexError:
            continue

        if codigo is None or precio is None:
            continue

        try:
            precio_decimal = Decimal(str(precio).replace(",", ".").replace("$", "").strip())
            denominacion_str = str(denominacion).strip() if denominacion is not None else ""
            if denominacion_str and max_len_denominacion:
                denominacion_str = denominacion_str[:max_len_denominacion]
            codigo_norm = normalizar_codigo_proveedor(codigo)
            to_create.append(
                PrecioProveedorExcel(
                    proveedor=proveedor,
                    codigo_producto_excel=codigo_norm,
                    precio=precio_decimal,
                    denominacion=denominacion_str,
                    nombre_archivo=filename,
                )
            )
        except Exception:
            continue

    unique_map = {}
    for obj in to_create:
        key = (obj.proveedor_id, obj.codigo_producto_excel)
        unique_map[key] = obj
    to_create = list(unique_map.values())

    now = timezone.now()
    registros_actualizados = 0

    with transaction.atomic():
        PrecioProveedorExcel.objects.bulk_create(to_create, batch_size=500)

        precio_por_codigo = {
            obj.codigo_producto_excel: obj.precio
            for obj in to_create
            if obj.codigo_producto_excel
        }
        codigos = list(precio_por_codigo.keys())

        if codigos:
            stock_proves = list(
                StockProve.objects.filter(
                    proveedor=proveedor,
                    codigo_producto_proveedor__in=codigos,
                )
            )

            for stock_prove in stock_proves:
                codigo = normalizar_codigo_proveedor(stock_prove.codigo_producto_proveedor)
                nuevo_costo = precio_por_codigo.get(codigo)
                if nuevo_costo is None:
                    continue
                stock_prove.costo = nuevo_costo
                stock_prove.fecha_actualizacion = now

            if stock_proves:
                StockProve.objects.bulk_update(
                    stock_proves,
                    ["costo", "fecha_actualizacion"],
                    batch_size=500,
                )
                registros_actualizados = len(stock_proves)

        HistorialImportacionProveedor.objects.create(
            proveedor=proveedor,
            nombre_archivo=filename,
            registros_procesados=len(to_create),
            registros_actualizados=registros_actualizados,
        )

    return {
        "precios_cargados": len(to_create),
        "registros_actualizados": registros_actualizados,
    }
