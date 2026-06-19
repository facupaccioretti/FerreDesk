import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MINIMO_CARACTERES_BUSQUEDA_PRODUCTO,
  LIMITE_BUSQUEDA_PRODUCTO_POR_DEFECTO,
  buscarProductosLigeroActual,
  construirClaveTenantProducto,
  obtenerScopeTenantProducto,
} from '../services/productoLookupApi'

const STALE_TIME_BUSQUEDA_LIGERA = 60 * 1000
const GC_TIME_BUSQUEDA_LIGERA = 10 * 60 * 1000

export function useProductoBusquedaLigera({
  termino = '',
  limit = LIMITE_BUSQUEDA_PRODUCTO_POR_DEFECTO,
  listaPrecioId = 0,
  modo = 'venta',
  debounceMs = 250,
  enabled = true,
  staleTime = STALE_TIME_BUSQUEDA_LIGERA,
  gcTime = GC_TIME_BUSQUEDA_LIGERA,
} = {}) {
  const queryClient = useQueryClient()
  const tenantScope = obtenerScopeTenantProducto()
  const [terminoDebounced, setTerminoDebounced] = useState(String(termino || '').trim())

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerminoDebounced(String(termino || '').trim())
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [debounceMs, termino])

  const queryKey = construirClaveTenantProducto('producto-busqueda-ligera', {
    q: terminoDebounced.toLowerCase(),
    limit,
    listaPrecioId,
    modo,
  })

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => buscarProductosLigeroActual({
      termino: terminoDebounced,
      limit,
      signal,
    }),
    enabled: enabled && terminoDebounced.length >= MINIMO_CARACTERES_BUSQUEDA_PRODUCTO,
    staleTime,
    gcTime,
    placeholderData: (previos) => previos,
  })

  const invalidarCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['producto-busqueda-ligera', tenantScope] })
  }, [queryClient, tenantScope])

  return {
    tenantScope,
    queryKey,
    terminoDebounced,
    resultados: query.data ?? [],
    cargando: query.isLoading,
    actualizando: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
    invalidarCache,
  }
}
