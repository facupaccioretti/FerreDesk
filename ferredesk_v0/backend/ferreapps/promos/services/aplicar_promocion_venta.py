from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ferreapps.productos.models import StockProve
from ferreapps.promos.models import Promocion, PromocionItem


def _promo_vigente(promocion):
    if not promocion.activa:
        return False
    hoy = timezone.localdate()
    if promocion.fecha_inicio and promocion.fecha_inicio > hoy:
        return False
    if promocion.fecha_fin and promocion.fecha_fin < hoy:
        return False
    return True


def _resolver_promocion(promocion_id):
    promocion = (
        Promocion.objects.filter(pk=promocion_id)
        .prefetch_related(
            Prefetch(
                'items',
                queryset=PromocionItem.objects.select_related('stock', 'stock__idaliiva'),
            )
        )
        .first()
    )
    if promocion is None:
        raise ValidationError({'items': [f'La promocion {promocion_id} no existe.']})
    if not _promo_vigente(promocion):
        raise ValidationError({'items': [f'La promocion "{promocion.nombre}" no esta vigente.']})

    items_promocion = list(promocion.items.all())
    if not items_promocion:
        raise ValidationError({'items': [f'La promocion "{promocion.nombre}" no tiene componentes.']})

    return promocion, items_promocion


def _costos_habituales(items_promocion):
    """Costo actual (StockProve del proveedor habitual de cada componente),
    resuelto en un solo query. Se congela para el resto de la operacion.
    """
    condiciones = Q()
    for item in items_promocion:
        condiciones |= Q(stock_id=item.stock_id, proveedor_id=item.stock.proveedor_habitual_id)

    filas = StockProve.objects.filter(condiciones).values('stock_id', 'proveedor_id', 'costo')
    costos_por_par = {(f['stock_id'], f['proveedor_id']): f['costo'] for f in filas}
    return {
        item.stock_id: costos_por_par.get((item.stock_id, item.stock.proveedor_habitual_id), Decimal('0'))
        for item in items_promocion
    }


def _prorratear_por_alicuota(items_promocion, precio_total_con_iva):
    """Reparte precio_total_con_iva (ya multiplicado por la cantidad
    vendida) entre los grupos de alicuota de los componentes, proporcional
    al precio de lista de cada componente. Si ningun componente tiene
    precio de lista cargado, reparte en partes iguales entre los grupos
    presentes. El ultimo grupo absorbe el residuo para que la suma cierre
    exacto contra precio_total_con_iva.
    """
    pesos_por_alicuota = {}
    alicuota_obj_por_id = {}
    orden_alicuotas = []
    for item in items_promocion:
        alicuota = item.stock.idaliiva
        if alicuota.id not in pesos_por_alicuota:
            pesos_por_alicuota[alicuota.id] = Decimal('0')
            alicuota_obj_por_id[alicuota.id] = alicuota
            orden_alicuotas.append(alicuota.id)
        pesos_por_alicuota[alicuota.id] += (item.stock.precio_lista_0 or Decimal('0')) * item.cantidad

    # Orden deterministico (por porcentaje de alicuota, no por orden de llegada de la
    # query): dos ventas de la misma promo deben repartir el residuo siempre al mismo
    # grupo, para que el desglose de IVA sea reproducible.
    orden_alicuotas.sort(key=lambda alicuota_id: alicuota_obj_por_id[alicuota_id].porce)

    total_peso = sum(pesos_por_alicuota.values())
    if total_peso <= 0:
        pesos_por_alicuota = {alicuota_id: Decimal('1') for alicuota_id in orden_alicuotas}
        total_peso = Decimal(len(orden_alicuotas))

    resultado = []
    restante = precio_total_con_iva
    ultimo_indice = len(orden_alicuotas) - 1
    for idx, alicuota_id in enumerate(orden_alicuotas):
        alicuota = alicuota_obj_por_id[alicuota_id]
        divisor_iva = Decimal('1') + (alicuota.porce / Decimal('100'))
        if idx == ultimo_indice:
            monto_final = restante
        else:
            proporcion = pesos_por_alicuota[alicuota_id] / total_peso
            monto_final = (precio_total_con_iva * proporcion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            restante -= monto_final
        neto = (monto_final / divisor_iva).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        iva_monto = monto_final - neto
        resultado.append({
            'alicuota_id': alicuota_id,
            'neto': neto,
            'iva_monto': iva_monto,
            'monto_final': monto_final,
        })
    return resultado


def _margen_informativo(precio_unitario_final, costo_unitario_promo, alicuota_dominante_porce):
    """Margen % puramente informativo (no afecta neto/IVA reales, esos salen
    del desglose por alicuota). Usa la alicuota dominante como aproximacion,
    igual que el resto de los campos vdi_margen existentes en el sistema.
    """
    if costo_unitario_promo <= 0:
        return Decimal('0')
    divisor = Decimal('1') + (alicuota_dominante_porce / Decimal('100'))
    precio_unit_sin_iva = precio_unitario_final / divisor
    return ((precio_unit_sin_iva - costo_unitario_promo) / costo_unitario_promo * Decimal('100')).quantize(
        Decimal('0.001'), rounding=ROUND_HALF_UP
    )


def expandir_item_promocion(item_payload):
    """Convierte un pseudo-item de promo (payload con 'vdi_promocion' y
    'vdi_cantidad') en un item real de VentaDetalleItem, mas la data de
    snapshot a persistir una vez creada la linea. No toca stock: eso lo
    hace `descontar_stock_promocion`, aparte.
    """
    promocion_id = item_payload.get('vdi_promocion')
    promocion, items_promocion = _resolver_promocion(promocion_id)

    try:
        cantidad_vendida = Decimal(str(item_payload.get('vdi_cantidad') or 0))
    except Exception as exc:
        raise ValidationError({'items': ['Cantidad invalida para la promocion.']}) from exc
    if cantidad_vendida <= 0:
        raise ValidationError({'items': ['La cantidad de la promocion debe ser mayor a cero.']})

    costos_por_stock = _costos_habituales(items_promocion)
    costo_unitario_promo = sum(
        (costos_por_stock[item.stock_id] * item.cantidad for item in items_promocion),
        Decimal('0'),
    )

    precio_unitario_final = promocion.precio_promocional
    precio_total_con_iva = (precio_unitario_final * cantidad_vendida).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    desglose_alicuotas = _prorratear_por_alicuota(items_promocion, precio_total_con_iva)
    grupo_dominante = max(desglose_alicuotas, key=lambda grupo: grupo['monto_final'])
    alicuota_dominante_id = grupo_dominante['alicuota_id']
    alicuota_dominante_porce = next(
        item.stock.idaliiva.porce for item in items_promocion if item.stock.idaliiva_id == alicuota_dominante_id
    )

    item_real = dict(item_payload)
    item_real.pop('vdi_promocion', None)
    item_real.update({
        'vdi_idsto': None,
        'vdi_idpro': None,
        'vdi_promocion': promocion.id,
        'vdi_cantidad': cantidad_vendida,
        'vdi_costo': costo_unitario_promo,
        'vdi_margen': _margen_informativo(precio_unitario_final, costo_unitario_promo, alicuota_dominante_porce),
        'vdi_precio_unitario_final': precio_unitario_final,
        'vdi_detalle1': item_payload.get('vdi_detalle1') or promocion.nombre,
        'vdi_detalle2': item_payload.get('vdi_detalle2') or '',
        'vdi_idaliiva': alicuota_dominante_id,
    })

    item_real['_promo_snapshot'] = {
        'componentes': [
            {
                'stock_id': item.stock_id,
                'proveedor_id': item.stock.proveedor_habitual_id,
                'cantidad_por_promo': item.cantidad,
                'costo_unitario': costos_por_stock[item.stock_id],
            }
            for item in items_promocion
        ],
        'alicuotas': [
            {
                'alicuota_id': grupo['alicuota_id'],
                'neto': grupo['neto'],
                'iva_monto': grupo['iva_monto'],
            }
            for grupo in desglose_alicuotas
        ],
    }
    return item_real


def expandir_items_promocion(items):
    """Reemplaza cada pseudo-item de promo de la lista por su item real
    expandido (con snapshot adjunto). El resto de los items pasa sin tocar.
    Debe llamarse antes de cualquier logica de stock o de creacion de venta,
    para que ambas vean items ya normalizados.
    """
    return [
        expandir_item_promocion(item) if item.get('vdi_promocion') and '_promo_snapshot' not in item else item
        for item in items
    ]


def resolver_items_nuevos_cambio(items):
    """Normaliza los items nuevos de un cambio sin perder que una promo es
    una sola linea comercial. Las operaciones de stock quedan separadas para
    que el cambio pueda descontar sus componentes en la misma transaccion.
    """
    resultado = []
    for item in items:
        if item.get('promocion_id') is not None:
            item_venta = expandir_item_promocion({
                'vdi_promocion': item['promocion_id'],
                'vdi_cantidad': item['cantidad'],
            })
            cantidad = Decimal(str(item_venta['vdi_cantidad']))
            resultado.append({
                'tipo': 'promocion',
                'promocion_id': item_venta['vdi_promocion'],
                'cantidad': cantidad,
                'precio_unitario': item_venta['vdi_precio_unitario_final'],
                'detalle': item_venta['vdi_detalle1'],
                'item_venta': item_venta,
                'operaciones_stock': [
                    {
                        'stock_id': componente['stock_id'],
                        'proveedor_id': componente['proveedor_id'],
                        'cantidad': componente['cantidad_por_promo'] * cantidad,
                    }
                    for componente in item_venta['_promo_snapshot']['componentes']
                ],
            })
            continue

        cantidad = Decimal(str(item['cantidad']))
        resultado.append({
            'tipo': 'stock',
            'stock_id': item['stock_id'],
            'cantidad': cantidad,
            'precio_unitario': Decimal(str(item['precio_unitario'])),
            'operaciones_stock': [{
                'stock_id': item['stock_id'],
                'cantidad': cantidad,
            }],
        })
    return resultado


def resolver_operaciones_stock(items):
    """Aplana los items (ya expandidos) en una lista de operaciones de
    stock -- una por producto suelto, una por CADA componente de cada
    promo -- y la ordena por stock_id.

    Se resuelve todo en una unica lista ordenada, en vez de bloquear
    promo por promo en el orden de sus propios componentes, porque asi se
    garantiza un orden global de bloqueo de StockProve: dos ventas
    concurrentes con productos y promos superpuestos podrian bloquear en
    orden distinto y deadlockear si cada una procesara sus items tal como
    llegan.

    Devuelve (operaciones, errores): `operaciones` es la lista ordenada de
    {'stock_id', 'proveedor_id', 'cantidad'} y `errores` son mensajes de
    items sueltos sin proveedor habitual resoluble (los items genericos,
    sin stock, simplemente no generan operacion).
    """
    from ferreapps.ventas.views.utils_stock import _obtener_codigo_venta, _obtener_proveedor_habitual_stock

    operaciones = []
    errores = []
    for item in items:
        snapshot = item.get('_promo_snapshot')
        if snapshot:
            cantidad_vendida = Decimal(str(item.get('vdi_cantidad', 0)))
            for componente in snapshot['componentes']:
                operaciones.append({
                    'stock_id': componente['stock_id'],
                    'proveedor_id': componente['proveedor_id'],
                    'cantidad': componente['cantidad_por_promo'] * cantidad_vendida,
                })
            continue

        id_stock = item.get('vdi_idsto')
        if not id_stock:
            continue

        id_proveedor = _obtener_proveedor_habitual_stock(id_stock)
        if not id_proveedor:
            cod = _obtener_codigo_venta(id_stock)
            errores.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock})")
            continue

        operaciones.append({
            'stock_id': id_stock,
            'proveedor_id': id_proveedor,
            'cantidad': Decimal(str(item.get('vdi_cantidad', 0))),
        })

    operaciones.sort(key=lambda op: str(op['stock_id']).zfill(20))
    return operaciones, errores


def resolver_operaciones_stock_desde_detalles(detalles):
    """Igual que `resolver_operaciones_stock`, pero a partir de
    VentaDetalleItem ya persistidos (por ejemplo al convertir un
    presupuesto a venta), usando el snapshot ya guardado en
    VentaPromocionComponente en vez de expandir la promo de nuevo -- la
    promo pudo haber cambiado entre la carga del presupuesto y su
    conversion, y la conversion debe descontar lo que efectivamente se
    congelo en el presupuesto.
    """
    from ferreapps.ventas.views.utils_stock import _obtener_codigo_venta, _obtener_proveedor_habitual_stock

    operaciones = []
    errores = []
    for detalle in detalles:
        if detalle.vdi_promocion_id:
            componentes = list(detalle.componentes_promocion.all())
            if not componentes:
                # Una linea de promo sin snapshot no puede pasar en el flujo normal
                # (se crea junto con el detalle, en la misma transaccion). Si igual
                # aparece -- dato manipulado a mano, o una fila vieja de antes de
                # que este snapshot existiera -- no descontar nada en silencio: es
                # mejor frenar la conversion con un error claro.
                errores.append(
                    f"La linea de promocion {detalle.id} no tiene snapshot de componentes guardado; "
                    "no se puede determinar que stock descontar. Revisar el dato manualmente."
                )
                continue
            for componente in componentes:
                operaciones.append({
                    'stock_id': componente.stock_id,
                    'proveedor_id': componente.proveedor_id,
                    'cantidad': componente.cantidad_por_promo * detalle.vdi_cantidad,
                })
            continue

        id_stock = detalle.vdi_idsto_id
        if not id_stock:
            errores.append(f"Falta stock en item: {detalle.id}")
            continue

        id_proveedor = _obtener_proveedor_habitual_stock(id_stock)
        if not id_proveedor:
            cod = _obtener_codigo_venta(id_stock)
            errores.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock})")
            continue

        if not detalle.vdi_idpro_id:
            detalle.vdi_idpro_id = id_proveedor
            detalle.save(update_fields=['vdi_idpro'])

        operaciones.append({
            'stock_id': id_stock,
            'proveedor_id': id_proveedor,
            'cantidad': detalle.vdi_cantidad,
        })

    operaciones.sort(key=lambda op: str(op['stock_id']).zfill(20))
    return operaciones, errores


def crear_snapshot_promocion(detalle, snapshot):
    """Persiste VentaPromocionComponente y VentaDetalleItemPromoAlicuota
    para una linea ya creada. Se llama justo despues de
    VentaDetalleItem.objects.create() con el snapshot que trae ese item
    (la clave '_promo_snapshot' de expandir_item_promocion).

    No dispara el recalculo de totales de la venta: el post_save de
    VentaDetalleItem ya lo dispara al crear la linea, pero en ese momento
    las filas de IVA de la promo todavia no existen (se crean aca, despues).
    El caller es responsable de invocar `recalcular_totales_venta_si_hace_falta`
    una unica vez, despues de procesar TODOS los items de la venta -- no una
    vez por cada linea de promo, que es redundante y, si la venta tiene varias
    promos, hace que el recalculo intermedio ignore las que todavia no
    llegaron a este punto del loop.
    """
    if not snapshot:
        return

    from ferreapps.ventas.models import VentaDetalleItemPromoAlicuota, VentaPromocionComponente

    VentaPromocionComponente.objects.bulk_create([
        VentaPromocionComponente(
            detalle=detalle,
            stock_id=componente['stock_id'],
            proveedor_id=componente['proveedor_id'],
            cantidad_por_promo=componente['cantidad_por_promo'],
            costo_unitario=componente['costo_unitario'],
        )
        for componente in snapshot['componentes']
    ])
    VentaDetalleItemPromoAlicuota.objects.bulk_create([
        VentaDetalleItemPromoAlicuota(
            detalle=detalle,
            alicuota_id=grupo['alicuota_id'],
            neto=grupo['neto'],
            iva_monto=grupo['iva_monto'],
        )
        for grupo in snapshot['alicuotas']
    ])


def recalcular_totales_venta_si_hace_falta(venta_id, *, hubo_snapshot_promocion):
    """Recalcula los totales denormalizados de la venta una unica vez, solo
    si se creo o reemplazo al menos un snapshot de promo durante el request.
    Para lineas sin promo el post_save de VentaDetalleItem ya deja los
    totales correctos; no hace falta este segundo recalculo.
    """
    if not hubo_snapshot_promocion:
        return
    from ferreapps.ventas.signals import _recalcular_totales_venta
    _recalcular_totales_venta(venta_id)


def construir_item_devolucion_promocion(detalle_original, cantidad_devuelta, cantidad_disponible=None):
    """Arma el item de Nota de Credito para devolver `cantidad_devuelta`
    unidades de una linea de promo ya vendida (`detalle_original`).

    Reusa el precio, costo y prorrateo de IVA ya congelados en esa venta --
    nunca la definicion actual de la Promocion, que pudo haber cambiado,
    desactivado o reemplazado componentes despues de la venta (invariante
    de postventa: la devolucion usa el snapshot, no la composicion actual).

    `cantidad_disponible` es el remanente real (cantidad original menos lo ya
    devuelto en operaciones previas), que el caller ya conoce por haber
    llamado a `validar_items_devolucion`/`previsualizar_devolucion`. Si no se
    pasa, se valida solo contra la cantidad original de la linea -- correcto
    unicamente si esta es la primera devolucion de esa linea; un caller que
    invoque esta funcion sin conocer el remanente es responsable de validarlo
    el mismo antes de llamar.

    El resultado ya trae '_promo_snapshot' armado, así que
    expandir_items_promocion lo deja pasar sin re-expandirlo.
    """
    cantidad_original = detalle_original.vdi_cantidad
    if cantidad_original <= 0:
        raise ValidationError({'items': ['La linea de promocion original no tiene una cantidad valida.']})
    cantidad_maxima = cantidad_original if cantidad_disponible is None else Decimal(str(cantidad_disponible))
    cantidad_devuelta = Decimal(str(cantidad_devuelta))
    if cantidad_devuelta <= 0 or cantidad_devuelta > cantidad_maxima:
        raise ValidationError({'items': ['Cantidad de promocion a devolver invalida.']})

    alicuotas_originales = list(detalle_original.promo_alicuotas.select_related('alicuota').all())
    if not alicuotas_originales:
        raise ValidationError({'items': ['La linea de promocion original no tiene desglose de IVA guardado.']})

    monto_total_devuelto = (detalle_original.vdi_precio_unitario_final * cantidad_devuelta).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    peso_total = sum((grupo.neto + grupo.iva_monto for grupo in alicuotas_originales), Decimal('0'))

    desglose = []
    restante = monto_total_devuelto
    ultimo_indice = len(alicuotas_originales) - 1
    for idx, grupo in enumerate(alicuotas_originales):
        if idx == ultimo_indice or peso_total <= 0:
            monto_final = restante
        else:
            proporcion = (grupo.neto + grupo.iva_monto) / peso_total
            monto_final = (monto_total_devuelto * proporcion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            restante -= monto_final
        divisor_iva = Decimal('1') + (grupo.alicuota.porce / Decimal('100'))
        neto = (monto_final / divisor_iva).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        iva_monto = monto_final - neto
        desglose.append({'alicuota_id': grupo.alicuota_id, 'neto': neto, 'iva_monto': iva_monto})

    componentes = [
        {
            'stock_id': componente.stock_id,
            'proveedor_id': componente.proveedor_id,
            'cantidad_por_promo': componente.cantidad_por_promo,
            'costo_unitario': componente.costo_unitario,
        }
        for componente in detalle_original.componentes_promocion.all()
    ]

    return {
        'vdi_idsto': None,
        'vdi_idpro': None,
        'vdi_promocion': detalle_original.vdi_promocion_id,
        'vdi_cantidad': cantidad_devuelta,
        'vdi_costo': detalle_original.vdi_costo,
        'vdi_margen': detalle_original.vdi_margen,
        'vdi_bonifica': Decimal('0'),
        'vdi_precio_unitario_final': detalle_original.vdi_precio_unitario_final,
        'vdi_detalle1': detalle_original.vdi_detalle1,
        'vdi_detalle2': detalle_original.vdi_detalle2,
        'vdi_idaliiva': detalle_original.vdi_idaliiva_id,
        '_promo_snapshot': {
            'componentes': componentes,
            'alicuotas': desglose,
        },
    }
