// usePromocionesAPI.js — Acceso a datos del recurso Promocion via TanStack Query.
//
// POR QUE: Sigue el mismo patron que el resto de FerreDesk (usePaginacionAPI para
// listados paginados + cache, useMutation para altas/bajas/ediciones con
// invalidacion de queryKeys.resources). No agrega ninguna libreria nueva.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePaginacionAPI } from '../../../hooks/usePaginacionAPI'
import { queryKeys } from '../../../core/query/queryKeys'
import { clienteAPI } from '../../../utils/clienteAPI'

const URL_BASE = '/api/promos/promociones/'
const CLAVE_CACHE = 'promociones'
const CLAVE_CACHE_DESACTUALIZADAS = 'promociones-desactualizadas'
const CLAVE_CACHE_VIGENTES = 'promociones-vigentes'

/**
 * Listado + mutaciones para la seccion administrativa (Productos > Promociones).
 * @param {Object} opciones
 * @param {'activas'|'inactivas'|'desactualizadas'} opciones.estado
 * @param {number} opciones.pagina
 * @param {number} opciones.itemsPorPagina
 */
export function usePromocionesAPI({ estado = 'activas', pagina = 1, itemsPorPagina = 20 } = {}) {
  const queryClient = useQueryClient()

  const esDesactualizadas = estado === 'desactualizadas'
  const urlListado = esDesactualizadas ? `${URL_BASE}desactualizadas/` : URL_BASE
  const claveListado = esDesactualizadas ? CLAVE_CACHE_DESACTUALIZADAS : CLAVE_CACHE
  const filtros = esDesactualizadas ? {} : { activa: estado === 'inactivas' ? 'false' : 'true' }

  const listado = usePaginacionAPI(claveListado, urlListado, filtros, pagina, itemsPorPagina)

  // Una promo puede aparecer en mas de un listado (activas/inactivas/desactualizadas)
  // segun la mutacion, asi que cualquier cambio invalida los tres.
  const invalidarTodo = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.resources.all(CLAVE_CACHE) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resources.all(CLAVE_CACHE_DESACTUALIZADAS) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.resources.all(CLAVE_CACHE_VIGENTES) }),
    ])
  }

  const crearPromocionMutation = useMutation({
    mutationFn: (payload) => clienteAPI(URL_BASE, { method: 'POST', body: payload }),
    onSuccess: invalidarTodo,
  })

  const editarPromocionMutation = useMutation({
    mutationFn: ({ id, payload }) => clienteAPI(`${URL_BASE}${id}/`, { method: 'PATCH', body: payload }),
    onSuccess: invalidarTodo,
  })

  // Activar/desactivar es el mismo endpoint, solo cambia el valor booleano enviado.
  const cambiarEstadoPromocionMutation = useMutation({
    mutationFn: ({ id, activa }) => clienteAPI(`${URL_BASE}${id}/`, { method: 'PATCH', body: { activa } }),
    onSuccess: invalidarTodo,
  })

  // Revision explicita: el usuario decide dejar la promo tal cual pese al
  // cambio de costo detectado, sin editar precio ni componentes.
  const revisarPromocionMutation = useMutation({
    mutationFn: (id) => clienteAPI(`${URL_BASE}${id}/revisar/`, { method: 'POST' }),
    onSuccess: invalidarTodo,
  })

  return {
    ...listado,

    crearPromocion: crearPromocionMutation.mutateAsync,
    creando: crearPromocionMutation.isPending,

    editarPromocion: (id, payload) => editarPromocionMutation.mutateAsync({ id, payload }),
    editando: editarPromocionMutation.isPending,

    activarPromocion: (id) => cambiarEstadoPromocionMutation.mutateAsync({ id, activa: true }),
    desactivarPromocion: (id) => cambiarEstadoPromocionMutation.mutateAsync({ id, activa: false }),
    cambiandoEstado: cambiarEstadoPromocionMutation.isPending,

    revisarPromocion: (id) => revisarPromocionMutation.mutateAsync(id),
    revisando: revisarPromocionMutation.isPending,
  }
}

/**
 * Listado de promociones activas Y vigentes por fecha (listas para venderse),
 * para el selector de venta (SelectorPromocionModal). No incluye promos
 * desactivadas ni fuera de su rango de fechas: eso lo filtra el backend
 * (selectors/promociones_activas.py), no hay que repetir la regla aca.
 */
export function usePromocionesVigentesAPI({ pagina = 1, itemsPorPagina = 50 } = {}) {
  return usePaginacionAPI(CLAVE_CACHE_VIGENTES, `${URL_BASE}activas/`, {}, pagina, itemsPorPagina)
}

/**
 * Trae una Promocion completa (items + grupos) por id, fuera del ciclo de
 * TanStack Query. Se usa al reconfigurar una linea de promo ya vendida: el
 * snapshot congelado de esa linea (componentes_promocion) no alcanza para
 * saber a que grupo pertenece cada componente, hace falta la definicion
 * actual completa para volver a armar el selector de alternativas.
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function obtenerPromocionPorId(id) {
  return clienteAPI(`${URL_BASE}${id}/`)
}
