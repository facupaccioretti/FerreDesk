import { useState, useEffect, useCallback } from 'react'
import { getCookie } from './csrf'

export const useComprasAPI = () => {
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    currentPage: 1,
    pageSize: 10
  })

  // Función para hacer requests con headers apropiados (memoizada)
  const makeRequest = useCallback(async (url, options = {}) => {
    const csrfToken = getCookie('csrftoken')

    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    }

    const response = await fetch(url, { ...defaultOptions, ...options })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }, [])

  // Obtener lista de compras
  const fetchCompras = useCallback(async (filters = {}, page = 1, pageSize = 10, orderBy = 'id', orderDirection = 'desc') => {
    setLoading(true)
    setError(null)
    
    try {
      const queryParams = new URLSearchParams()
      
      // Agregar parámetros de paginación
      queryParams.append('page', page.toString())
      queryParams.append('limit', pageSize.toString())
      
      // Agregar parámetros de ordenamiento
      queryParams.append('orden', orderBy)
      queryParams.append('direccion', orderDirection)
      
      // Agregar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value)
        }
      })

      const url = `/api/compras/?${queryParams.toString()}`
      const data = await makeRequest(url)
      
      // Manejar respuesta paginada
      if (data.results) {
        setCompras(data.results)
        setPagination({
          count: data.count || 0,
          next: data.next,
          previous: data.previous,
          currentPage: page,
          pageSize: pageSize
        })
      } else {
        // Fallback para respuestas no paginadas
        setCompras(data)
        setPagination({
          count: data.length || 0,
          next: null,
          previous: null,
          currentPage: 1,
          pageSize: data.length || 0
        })
      }
    } catch (err) {
      setError(err.message)
      console.error('Error fetching compras:', err)
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Crear nueva compra
  const addCompra = useCallback(async (compraData) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest('/api/compras/', {
        method: 'POST',
        body: JSON.stringify(compraData),
      })
      
      // Actualizar la lista local
      setCompras(prev => [data, ...prev])
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error creating compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Actualizar compra existente
  const updateCompra = useCallback(async (compraId, compraData) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest(`/api/compras/${compraId}/`, {
        method: 'PUT',
        body: JSON.stringify(compraData),
      })
      
      // Actualizar la lista local
      setCompras(prev => prev.map(compra => 
        compra.comp_id === compraId ? data : compra
      ))
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error updating compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Eliminar compra
  const deleteCompra = useCallback(async (compraId) => {
    setLoading(true)
    setError(null)
    
    try {
      await makeRequest(`/api/compras/${compraId}/`, {
        method: 'DELETE',
      })
      
      // Actualizar la lista local
      setCompras(prev => prev.filter(compra => compra.comp_id !== compraId))
    } catch (err) {
      setError(err.message)
      console.error('Error deleting compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Cerrar compra
  const cerrarCompra = useCallback(async (compraId) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest(`/api/compras/${compraId}/cerrar/`, {
        method: 'POST',
      })
      
      // Actualizar la lista local
      setCompras(prev => prev.map(compra => 
        compra.comp_id === compraId ? { ...compra, comp_estado: 'CERRADA' } : compra
      ))
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error cerrando compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Anular compra
  const anularCompra = useCallback(async (compraId) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest(`/api/compras/${compraId}/anular/`, {
        method: 'POST',
      })
      
      // Actualizar la lista local
      setCompras(prev => prev.map(compra => 
        compra.comp_id === compraId ? { ...compra, comp_estado: 'ANULADA' } : compra
      ))
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error anulando compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Obtener compra por ID
  const getCompraById = useCallback(async (compraId) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest(`/api/compras/${compraId}/`)
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error fetching compra:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Obtener estadísticas
  const getEstadisticas = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await makeRequest('/api/compras/estadisticas/')
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error fetching estadísticas:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [makeRequest])

  // Cargar datos iniciales
  useEffect(() => {
    fetchCompras()
  }, [fetchCompras])

  return {
    compras,
    loading,
    error,
    pagination,
    fetchCompras,
    addCompra,
    updateCompra,
    deleteCompra,
    cerrarCompra,
    anularCompra,
    getCompraById,
    getEstadisticas,
  }
}
