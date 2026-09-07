"""
Utilidades para gestión de stock entre proveedores.
"""
from decimal import Decimal
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from ferreapps.productos.models import Stock, StockProve, Proveedor


def _obtener_stock_proveedores_bloqueado(stock_id):
    """
    Devuelve la lista de StockProve del producto (stock_id) con bloqueo select_for_update.
    """
    return list(StockProve.objects.select_for_update().filter(stock_id=stock_id).order_by('pk'))


def _total_disponible_en_proveedores(stock_id):
    """
    Suma el stock disponible entre todos los proveedores de un producto.
    Retorna (total: Decimal, proveedores: List[StockProve] bloqueados).
    """
    proveedores = _obtener_stock_proveedores_bloqueado(stock_id)
    total = sum((sp.cantidad for sp in proveedores), Decimal('0'))
    return total, proveedores


def _obtener_codigo_venta(stock_id):
    """
    Obtiene el código de venta (STO_CODVTA) del producto asociado al stock_id.
    Si no se encuentra, devuelve el propio stock_id como fallback.
    """
    try:
        stock = Stock.objects.get(id=stock_id)
        # El campo del código de venta en el modelo Stock suele ser 'codigo_venta' o similar; 
        # revisar atributos disponibles y usar el que exista.
        codigo = getattr(stock, 'codigo_venta', None) or getattr(stock, 'codvta', None) or getattr(stock, 'STO_CODVTA', None)
        return codigo or str(stock_id)
    except Stock.DoesNotExist:
        return str(stock_id)


def _obtener_nombre_proveedor(proveedor_id):
    """
    Obtiene el nombre del proveedor (razón social o fantasía) asociado al proveedor_id.
    Si no se encuentra, devuelve el propio proveedor_id como fallback.
    """
    try:
        proveedor = Proveedor.objects.get(id=proveedor_id)
        return proveedor.razon or proveedor.fantasia or str(proveedor_id)
    except Proveedor.DoesNotExist:
        return str(proveedor_id)


def _obtener_proveedor_habitual_stock(stock_id):
    """
    Obtiene el proveedor habitual de un stock.
    Como todos los productos tienen proveedor habitual obligatorio, esto nunca debería fallar.
    """
    try:
        stock = Stock.objects.get(id=stock_id)
        return stock.proveedor_habitual.id
    except Stock.DoesNotExist:
        return None
    except AttributeError:
        # Si por alguna razón el proveedor_habitual es None (no debería ocurrir)
        return None


def _descontar_distribuyendo(stock_id, proveedor_preferido_id, cantidad, permitir_stock_negativo, errores_stock, stock_actualizado):
    """
    Descuenta "cantidad" del stock del producto (stock_id), priorizando el proveedor preferido,
    y luego el resto de proveedores del mismo producto hasta cubrir la cantidad.

    - Si permitir_stock_negativo es True: primero distribuye todo el stock disponible, 
      luego descuenta lo que falte del proveedor preferido (puede quedar negativo).
    - Si permitir_stock_negativo es False: intenta distribuir. Si la suma total no alcanza, 
      no descuenta y agrega error.

    Agrega una entrada en stock_actualizado por cada proveedor afectado.
    Retorna True si se aplicó el descuento, False si no fue posible (y se registró el error).
    """
    try:
        cantidad = Decimal(str(cantidad))
    except Exception:
        cantidad = Decimal('0')

    # Obtener todos los proveedores con stock bloqueado
    total_disponible, proveedores_bloqueados = _total_disponible_en_proveedores(stock_id)
    
    # Si no permitir stock negativo, validar que alcance
    if not permitir_stock_negativo:
        if total_disponible < cantidad:
            cod = _obtener_codigo_venta(stock_id)
            errores_stock.append(
                f"Stock insuficiente para producto {cod}. Disponible total: {total_disponible}, solicitado: {cantidad}"
            )
            return False
    
    # Mapear por proveedor para acceso rápido (todas las instancias están bloqueadas)
    prov_map = {sp.proveedor_id: sp for sp in proveedores_bloqueados}
    orden_proveedores = []

    # 1) Proveedor preferido primero (si existe)
    if proveedor_preferido_id in prov_map:
        orden_proveedores.append(proveedor_preferido_id)

    # 2) Resto de proveedores por mayor disponibilidad
    resto = [sp for sp in proveedores_bloqueados if sp.proveedor_id != proveedor_preferido_id]
    resto.sort(key=lambda x: x.cantidad, reverse=True)
    orden_proveedores.extend([sp.proveedor_id for sp in resto])

    # Distribuir primero todo el stock disponible
    restante = cantidad
    for prov_id in orden_proveedores:
        if restante <= 0:
            break
        sp = prov_map[prov_id]
        disponible = Decimal(str(sp.cantidad))
        if disponible <= 0:
            continue
        consumir = min(disponible, restante)
        sp.cantidad = disponible - consumir
        sp.save()
        stock_actualizado.append((sp.stock_id, sp.proveedor_id, sp.cantidad))
        restante -= consumir

    # Si aún queda cantidad por descontar y está permitido stock negativo
    if restante > 0 and permitir_stock_negativo:
        # Verificar que existe el proveedor preferido
        if proveedor_preferido_id not in prov_map:
            cod = _obtener_codigo_venta(stock_id)
            nombre_proveedor = _obtener_nombre_proveedor(proveedor_preferido_id)
            errores_stock.append(f"No existe stock para el producto {cod} y proveedor {nombre_proveedor}")
            return False
        
        # Descontar lo que falte del proveedor preferido (puede quedar negativo)
        sp = prov_map[proveedor_preferido_id]
        sp.cantidad -= restante
        sp.save()
        stock_actualizado.append((sp.stock_id, sp.proveedor_id, sp.cantidad))
        restante = 0
    
    # Verificación final de seguridad
    if restante > 0:
        # No debería ocurrir, pero por seguridad
        cod = _obtener_codigo_venta(stock_id)
        errores_stock.append(
            f"Stock insuficiente para producto {cod}. Disponible total: {total_disponible}, solicitado: {cantidad}"
        )
        return False

    return True


def ajustar_stock_postventa(*, items_devueltos, detalles, items_nuevos, permitir_stock_negativo):
    reposiciones = []
    for item in items_devueltos:
        detalle = detalles[item["venta_detalle_item_id"]]
        if not detalle.vdi_idsto_id:
            continue
        denominacion = detalle.vdi_detalle1 or f"Producto {detalle.vdi_idsto_id}"
        if not detalle.vdi_idpro_id:
            raise ValidationError({"items": f"{denominacion} no tiene proveedor de referencia"})
        reposiciones.append((detalle, Decimal(str(item["cantidad"]))))

    stock_ids_nuevos = {item["stock_id"] for item in items_nuevos}
    condiciones = [Q(stock_id=detalle.vdi_idsto_id, proveedor_id=detalle.vdi_idpro_id) for detalle, _ in reposiciones]
    if stock_ids_nuevos:
        condiciones.append(Q(stock_id__in=stock_ids_nuevos))
    if condiciones:
        filtro = condiciones.pop()
        for condicion in condiciones:
            filtro |= condicion
        bloqueados = list(StockProve.objects.select_for_update().filter(filtro).order_by("pk"))
    else:
        bloqueados = []
    por_clave = {(stock_prove.stock_id, stock_prove.proveedor_id): stock_prove for stock_prove in bloqueados}
    proveedores_repuestos = {}
    for detalle, _ in reposiciones:
        stock_prove = por_clave.get((detalle.vdi_idsto_id, detalle.vdi_idpro_id))
        if stock_prove is None:
            denominacion = detalle.vdi_detalle1 or f"Producto {detalle.vdi_idsto_id}"
            raise ValidationError({"items": f"No existe stock para {denominacion} y su proveedor de referencia"})
        proveedores_repuestos[detalle.id] = stock_prove.proveedor_id

    proveedores_por_stock = {}
    for stock_prove in bloqueados:
        proveedores_por_stock.setdefault(stock_prove.stock_id, []).append(stock_prove)
    stocks_nuevos = Stock.objects.in_bulk(stock_ids_nuevos)
    descuentos = []
    for item in items_nuevos:
        stock_id = item["stock_id"]
        proveedores = proveedores_por_stock.get(stock_id, [])
        cantidad = Decimal(str(item["cantidad"]))
        if stock_id not in stocks_nuevos:
            raise ValidationError({"items_nuevos": f"Producto inexistente {stock_id}"})
        total_disponible = sum((proveedor.cantidad for proveedor in proveedores), Decimal("0"))
        total_disponible += sum(
            cantidad_repuesta
            for detalle_repuesto, cantidad_repuesta in reposiciones
            if detalle_repuesto.vdi_idsto_id == stock_id
        )
        if not permitir_stock_negativo and total_disponible < cantidad:
            raise ValidationError({"items_nuevos": f"Stock insuficiente para el producto {stock_id}"})
        descuentos.append((stocks_nuevos[stock_id], proveedores, cantidad))

    for detalle, cantidad in reposiciones:
        stock_prove = por_clave[(detalle.vdi_idsto_id, detalle.vdi_idpro_id)]
        stock_prove.cantidad += cantidad

    for stock, proveedores, cantidad in descuentos:
        por_proveedor = {proveedor.proveedor_id: proveedor for proveedor in proveedores}
        restante = cantidad
        orden = []
        if stock.proveedor_habitual_id in por_proveedor:
            orden.append(por_proveedor[stock.proveedor_habitual_id])
        orden.extend(sorted(
            (proveedor for proveedor in proveedores if proveedor.proveedor_id != stock.proveedor_habitual_id),
            key=lambda proveedor: (-proveedor.cantidad, proveedor.pk),
        ))
        for stock_prove in orden:
            disponible = max(stock_prove.cantidad, Decimal("0"))
            descontar = min(disponible, restante)
            stock_prove.cantidad -= descontar
            restante -= descontar
            if not restante:
                break
        if restante:
            stock_prove = por_proveedor.get(stock.proveedor_habitual_id)
            if stock_prove is None:
                raise ValidationError({"items_nuevos": f"No existe stock para el producto {stock.id} y proveedor habitual"})
            stock_prove.cantidad -= restante

    for stock_prove in bloqueados:
        stock_prove.save()
    return proveedores_repuestos





