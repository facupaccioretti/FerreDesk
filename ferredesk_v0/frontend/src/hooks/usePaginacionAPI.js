import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../core/query/queryKeys'
import { withQueryProfile } from '../core/query/queryProfiles'
import { clienteAPI } from '../utils/clienteAPI'

/**
 * usePaginacionAPI
 * Hook genérico de paginación con caché para FerreDesk.
 *
 * Implementa el patrón stale-while-revalidate de TanStack Query:
 * - Los datos de cada página se guardan en caché automáticamente.
 * - Al volver a una página ya visitada, los datos aparecen INSTANTÁNEAMENTE
 *   desde caché mientras la revalidación ocurre silenciosamente en segundo plano.
 * - Al cambiar de página, los datos anteriores se atenúan (isFetching=true)
 *   en lugar de desaparecer, eliminando el salto visual.
 *
 * @param {string} claveCacheBase - Nombre único del recurso (ej: "productos", "ventas"). Usado como clave de caché.
 * @param {string} urlBase - URL base del endpoint (ej: "/api/productos/stock/").
 * @param {Object} filtros - Parámetros de filtro adicionales (search, familia, proveedor, etc.).
 * @param {number} pagina - Página actual (1-indexed).
 * @param {number} itemsPorPagina - Cantidad de ítems por página.
 * @param {Object} [opciones={}] - Opciones adicionales de TanStack Query (staleTime, etc.).
 *
 * @returns {{
 *   datos: Array,
 *   total: number,
 *   cargando: boolean,
 *   actualizando: boolean,
 *   error: Error|null,
 *   invalidarCache: Function
 * }}
 *
 * Ejemplo de uso en un Manager:
 *   const { datos, total, cargando, actualizando } = usePaginacionAPI(
 *     'productos',
 *     '/api/productos/stock/',
 *     { acti: 'S', search: busqueda },
 *     pagina,
 *     itemsPorPagina
 *   )
 */
export function usePaginacionAPI(claveCacheBase, urlBase, filtros = {}, pagina = 1, itemsPorPagina = 10, opciones = {}) {
  const queryClient = useQueryClient()

  // Construir la URL con todos los parámetros
  const construirURL = () => {
    const params = new URLSearchParams()
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params.append(clave, String(valor))
      }
    })
    params.append('page', String(pagina))
    params.append('limit', String(itemsPorPagina))
    return params.toString() ? `${urlBase}?${params.toString()}` : urlBase
  }

  const url = construirURL()

  // La clave incluye todos los parámetros que afectan al resultado.
  // TanStack Query guarda en caché cada combinación única automáticamente.
  const parametrosQuery = {
    ...filtros,
    page: pagina,
    limit: itemsPorPagina,
  }
  const claveQuery = queryKeys.resources.list(claveCacheBase, parametrosQuery)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: claveQuery,
    queryFn: () => clienteAPI(url),
    ...withQueryProfile("warmCatalog", {
      // Mantener datos anteriores mientras llegan los nuevos (evita el parpadeo al cambiar de página)
      placeholderData: (datosAnteriores) => datosAnteriores,
      ...opciones,
    }),
  })

  /**
   * invalidarCache: fuerza una revalidación del recurso completo.
   * Usar después de crear, editar o eliminar un ítem para que la
   * tabla se actualice sin que el usuario tenga que recargar.
   */
  const invalidarCache = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resources.all(claveCacheBase) })
  }

  const resultados = Array.isArray(data) ? data : (data?.results ?? [])
  const total = Array.isArray(data) ? resultados.length : (data?.count ?? 0)

  return {
    datos: resultados,
    total,
    cargando: isLoading,     // true solo en la primera carga sin caché
    actualizando: isFetching, // true cuando hay datos pero se está revalidando (para atenuar tabla)
    error,
    invalidarCache,
  }
}
