import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  buscarProductoLookupRapidoActual,
  construirClaveTenantProducto,
  obtenerScopeTenantProducto,
} from '../services/productoLookupApi'

const STALE_TIME_LOOKUP_RAPIDO = 5 * 60 * 1000
const GC_TIME_LOOKUP_RAPIDO = 30 * 60 * 1000

export function useProductoLookupRapido({
  listaPrecioId = 0,
  modo = 'venta',
  staleTime = STALE_TIME_LOOKUP_RAPIDO,
  gcTime = GC_TIME_LOOKUP_RAPIDO,
} = {}) {
  const queryClient = useQueryClient()
  const tenantScope = obtenerScopeTenantProducto()

  const construirQueryKey = useCallback((codigo) => (
    construirClaveTenantProducto('producto-lookup-rapido', {
      codigo: String(codigo || '').trim().toLowerCase(),
      listaPrecioId,
      modo,
    })
  ), [listaPrecioId, modo])

  const obtenerDesdeCache = useCallback((codigo) => {
    const codigoNormalizado = String(codigo || '').trim()
    if (!codigoNormalizado) {
      return null
    }
    return queryClient.getQueryData(construirQueryKey(codigoNormalizado)) ?? null
  }, [construirQueryKey, queryClient])

  const lookupProducto = useCallback(async (codigo, opciones = {}) => {
    const codigoNormalizado = String(codigo || '').trim()
    if (!codigoNormalizado) {
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
      queryFn: ({ signal }) => buscarProductoLookupRapidoActual({
        codigo: codigoNormalizado,
        signal: opciones.signal ?? signal,
      }),
      staleTime,
      gcTime,
    })
  }, [construirQueryKey, gcTime, queryClient, staleTime])

  const precalentarProducto = useCallback(async (codigo) => {
    const codigoNormalizado = String(codigo || '').trim()
    if (!codigoNormalizado) {
      return null
    }

    await queryClient.prefetchQuery({
      queryKey: construirQueryKey(codigoNormalizado),
      queryFn: ({ signal }) => buscarProductoLookupRapidoActual({ codigo: codigoNormalizado, signal }),
      staleTime,
      gcTime,
    })

    return queryClient.getQueryData(construirQueryKey(codigoNormalizado)) ?? null
  }, [construirQueryKey, gcTime, queryClient, staleTime])

  const invalidarCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['producto-lookup-rapido', tenantScope] })
  }, [queryClient, tenantScope])

  return {
    tenantScope,
    construirQueryKey,
    obtenerDesdeCache,
    lookupProducto,
    precalentarProducto,
    invalidarCache,
  }
}
