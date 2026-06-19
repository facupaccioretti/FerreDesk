import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  buscarProductoLookupCompraActual,
  buscarProductosCompraLigeroActual,
  construirClaveTenantProducto,
  obtenerScopeTenantProducto,
} from '../services/productoLookupApi'

const STALE_TIME_LOOKUP_COMPRA = 5 * 60 * 1000
const GC_TIME_LOOKUP_COMPRA = 30 * 60 * 1000

export function useProductoLookupCompra({
  proveedorId = null,
  modoOrdenCompra = false,
  staleTime = STALE_TIME_LOOKUP_COMPRA,
  gcTime = GC_TIME_LOOKUP_COMPRA,
} = {}) {
  const queryClient = useQueryClient()
  const tenantScope = obtenerScopeTenantProducto()

  const construirQueryKey = useCallback((codigo) => (
    construirClaveTenantProducto('producto-lookup-compra', {
      codigo: String(codigo || '').trim().toLowerCase(),
      proveedorId,
      modoOrdenCompra,
    })
  ), [modoOrdenCompra, proveedorId])

  const obtenerDesdeCache = useCallback((codigo) => {
    const codigoNormalizado = String(codigo || '').trim()
    if (!codigoNormalizado || !proveedorId) {
      return null
    }
    return queryClient.getQueryData(construirQueryKey(codigoNormalizado)) ?? null
  }, [construirQueryKey, proveedorId, queryClient])

  const lookupProducto = useCallback(async (codigo, opciones = {}) => {
    const codigoNormalizado = String(codigo || '').trim()
    if (!codigoNormalizado || !proveedorId) {
      return null
    }

    if (!opciones.force) {
      const cache = queryClient.getQueryData(construirQueryKey(codigoNormalizado))
      if (cache) {
        return cache
      }
    }

    return queryClient.fetchQuery({
      queryKey: construirQueryKey(codigoNormalizado),
      queryFn: ({ signal }) => buscarProductoLookupCompraActual({
        codigo: codigoNormalizado,
        proveedorId,
        modoOrdenCompra,
        signal: opciones.signal ?? signal,
      }),
      staleTime,
      gcTime,
    })
  }, [construirQueryKey, gcTime, modoOrdenCompra, proveedorId, queryClient, staleTime])

  const buscarProductosProveedor = useCallback(async (termino, opciones = {}) => {
    const terminoNormalizado = String(termino || '').trim()
    if (!terminoNormalizado || !proveedorId) {
      return []
    }

    const limit = opciones.limit ?? 20
    return buscarProductosCompraLigeroActual({
      termino: terminoNormalizado,
      proveedorId,
      modoOrdenCompra,
      limit,
      signal: opciones.signal,
    })
  }, [modoOrdenCompra, proveedorId])

  const invalidarCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['producto-lookup-compra', tenantScope] })
  }, [queryClient, tenantScope])

  return {
    tenantScope,
    construirQueryKey,
    obtenerDesdeCache,
    lookupProducto,
    buscarProductosProveedor,
    invalidarCache,
  }
}
