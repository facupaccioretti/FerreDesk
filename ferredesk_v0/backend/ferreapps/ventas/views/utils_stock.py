"""
Utilidades para gestión de stock entre proveedores.
"""
from decimal import Decimal
from ferreapps.productos.models import Stock, StockProve, Proveedor


def _obtener_stock_proveedores_bloqueado(stock_id):
    """
    Devuelve la lista de StockProve del producto (stock_id) con bloqueo select_for_update.
    """
    return list(StockProve.objects.select_for_update().filter(stock_id=stock_id))


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



