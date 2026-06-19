import { clienteAPI } from '../utils/clienteAPI'

export const MINIMO_CARACTERES_BUSQUEDA_PRODUCTO = 2
export const LIMITE_BUSQUEDA_PRODUCTO_POR_DEFECTO = 20

function obtenerHostTenantActual() {
  if (typeof window === 'undefined' || !window.location?.host) {
    return 'tenant-desconocido'
  }
  return window.location.host.toLowerCase()
}

function normalizarNumero(valor, fallback = 0) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : fallback
}

function normalizarIdAlicuota(idaliiva) {
  if (idaliiva && typeof idaliiva === 'object') {
    return idaliiva.id ?? 3
  }
  return idaliiva ?? 3
}

function normalizarStockProveedor(stockProveedor) {
  if (!stockProveedor || typeof stockProveedor !== 'object') {
    return null
  }

  return {
    ...stockProveedor,
    costo: normalizarNumero(stockProveedor.costo, 0),
    cantidad: normalizarNumero(stockProveedor.cantidad, 0),
  }
}

function normalizarPreciosListas(preciosListas) {
  if (!Array.isArray(preciosListas)) {
    return []
  }

  return preciosListas.map((precio) => ({
    ...precio,
    precio: normalizarNumero(precio.precio, 0),
    lista_numero: normalizarNumero(precio.lista_numero, 0),
  }))
}

export function normalizarProductoVentaDTO(producto) {
  if (!producto || typeof producto !== 'object') {
    return null
  }

  const stockProveedores = Array.isArray(producto.stock_proveedores)
    ? producto.stock_proveedores.map(normalizarStockProveedor).filter(Boolean)
    : []

  const proveedorHabitual = producto.proveedor_habitual ?? null
  const proveedorHabitualId = producto.proveedor_habitual_id ?? proveedorHabitual?.id ?? null
  const costoHabitual = stockProveedores.find(
    (stockProveedor) => stockProveedor?.proveedor?.id === proveedorHabitualId
  )?.costo ?? normalizarNumero(producto.costo_habitual, 0)

  return {
    ...producto,
    id: producto.id,
    codvta: producto.codvta ?? producto.codigo ?? '',
    codigo: producto.codvta ?? producto.codigo ?? '',
    codigo_barras: producto.codigo_barras ?? '',
    deno: producto.deno ?? producto.nombre ?? '',
    nombre: producto.deno ?? producto.nombre ?? '',
    unidad: producto.unidad ?? producto.unidadmedida ?? '-',
    unidadmedida: producto.unidad ?? producto.unidadmedida ?? '-',
    idaliiva: normalizarIdAlicuota(producto.idaliiva),
    margen: normalizarNumero(producto.margen, 0),
    acti: producto.acti ?? 'S',
    stock_total: normalizarNumero(producto.stock_total ?? producto.stock, 0),
    stock: normalizarNumero(producto.stock_total ?? producto.stock, 0),
    precio_lista_0: normalizarNumero(producto.precio_lista_0, 0),
    precio_lista_0_manual: normalizarNumero(producto.precio_lista_0_manual, 0),
    precios_listas: normalizarPreciosListas(producto.precios_listas),
    stock_proveedores: stockProveedores,
    proveedor_habitual: proveedorHabitual,
    proveedor_habitual_id: proveedorHabitualId,
    costo_habitual: costoHabitual,
  }
}

export function normalizarProductoCompraDTO(producto) {
  const productoNormalizado = normalizarProductoVentaDTO(producto)
  if (!productoNormalizado) {
    return null
  }

  return {
    ...productoNormalizado,
    codigo_proveedor: producto.codigo_proveedor ?? '',
    stockprove_id: producto.stockprove_id ?? null,
    costo_proveedor: normalizarNumero(producto.costo_proveedor, 0),
  }
}

function limitarResultados(productos, limit) {
  return productos.slice(0, Math.max(1, limit))
}

export function construirClaveTenantProducto(segmento, parametros = {}) {
  const parametrosNormalizados = { ...parametros }
  Object.keys(parametrosNormalizados).forEach((clave) => {
    if (parametrosNormalizados[clave] === undefined || parametrosNormalizados[clave] === null || parametrosNormalizados[clave] === '') {
      delete parametrosNormalizados[clave]
    }
  })

  return [segmento, obtenerHostTenantActual(), parametrosNormalizados]
}

export async function buscarProductoLookupRapidoActual({ codigo, signal } = {}) {
  const codigoNormalizado = String(codigo || '').trim()
  if (!codigoNormalizado) {
    return null
  }

  try {
    const data = await clienteAPI(`/api/pos/productos/lookup/?codigo=${encodeURIComponent(codigoNormalizado)}`, { signal })
    return normalizarProductoVentaDTO(data)
  } catch (error) {
    if (error?.status === 404) {
      return null
    }
    throw error
  }
}

export async function buscarProductosLigeroActual({ termino, limit = LIMITE_BUSQUEDA_PRODUCTO_POR_DEFECTO, signal } = {}) {
  const terminoNormalizado = String(termino || '').trim()
  if (terminoNormalizado.length < MINIMO_CARACTERES_BUSQUEDA_PRODUCTO) {
    return []
  }

  const data = await clienteAPI(
    `/api/pos/productos/search/?q=${encodeURIComponent(terminoNormalizado)}&limit=${encodeURIComponent(limit)}`,
    { signal }
  )
  const resultados = Array.isArray(data) ? data : (data?.results ?? [])
  return resultados.map(normalizarProductoVentaDTO).filter(Boolean)
}

export async function buscarProductoLookupCompraActual({
  codigo,
  proveedorId,
  modoOrdenCompra = false,
  signal,
} = {}) {
  const codigoNormalizado = String(codigo || '').trim()
  if (!codigoNormalizado || !proveedorId) {
    return null
  }

  try {
    const data = await clienteAPI(
      `/api/compras/productos/lookup/?codigo=${encodeURIComponent(codigoNormalizado)}&proveedor_id=${encodeURIComponent(proveedorId)}`,
      { signal }
    )
    return normalizarProductoCompraDTO(data)
  } catch (error) {
    if (error?.status === 404) {
      return null
    }
    throw error
  }
}

export async function buscarProductosCompraLigeroActual({
  termino,
  proveedorId,
  modoOrdenCompra = false,
  limit = LIMITE_BUSQUEDA_PRODUCTO_POR_DEFECTO,
  signal,
} = {}) {
  const terminoNormalizado = String(termino || '').trim()
  if (terminoNormalizado.length < MINIMO_CARACTERES_BUSQUEDA_PRODUCTO || !proveedorId) {
    return []
  }

  const data = await clienteAPI(
    `/api/compras/proveedores/${proveedorId}/productos/?search=${encodeURIComponent(terminoNormalizado)}`,
    { signal }
  )
  const resultados = Array.isArray(data) ? data : (data?.results ?? [])
  const productos = resultados.map(normalizarProductoCompraDTO).filter(Boolean)

  if (modoOrdenCompra) {
    return limitarResultados(productos, limit)
  }

  return limitarResultados(
    productos.filter((producto) => {
      const texto = `${producto?.codigo_proveedor || ''} ${producto?.codvta || ''} ${producto?.deno || ''}`.toLowerCase()
      return terminoNormalizado
        .toLowerCase()
        .split(/\s+/)
        .every((parte) => texto.includes(parte))
    }),
    limit
  )
}

export function obtenerScopeTenantProducto() {
  return obtenerHostTenantActual()
}
