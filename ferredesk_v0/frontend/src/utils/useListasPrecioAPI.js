import { useState, useEffect, useCallback } from 'react';
import { getCookie } from './csrf';

/**
 * Hook para interactuar con la API de listas de precios.
 * Gestiona las 5 listas (0-4) y sus márgenes de descuento/recargo.
 */
export function useListasPrecioAPI() {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener todas las listas de precios
  const fetchListas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/listas-precio/', { 
        credentials: 'include' 
      });
      if (!res.ok) throw new Error('Error al obtener listas de precios');
      const data = await res.json();
      setListas(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Actualizar margen de una lista (dispara recálculo de precios)
  const actualizarLista = useCallback(async (listaId, datos) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/productos/listas-precio/${listaId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'include',
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw new Error('Error al actualizar lista de precios');
      const data = await res.json();
      
      // Actualizar lista en el estado local
      setListas(prev => prev.map(lista => 
        lista.id === listaId ? { ...lista, ...data } : lista
      ));
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener productos con precio manual desactualizado de una lista específica
  const obtenerManualesPendientes = useCallback(async (listaId) => {
    try {
      const res = await fetch(`/api/productos/listas-precio/${listaId}/manuales-pendientes/`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener productos manuales');
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Obtener todos los productos con precios manuales desactualizados (todas las listas 1-4)
  const obtenerProductosDesactualizados = useCallback(async () => {
    try {
      const res = await fetch('/api/productos/precios-lista/productos-desactualizados/', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener productos desactualizados');
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Cargar listas al montar
  useEffect(() => {
    fetchListas();
  }, [fetchListas]);

  return {
    listas,
    loading,
    error,
    fetchListas,
    actualizarLista,
    obtenerManualesPendientes,
    obtenerProductosDesactualizados,
  };
}

/**
 * Hook para gestionar precios de productos por lista.
 */
export function usePreciosProductoListaAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener precios de un producto específico
  const obtenerPreciosProducto = useCallback(async (stockId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/productos/precios-lista/?stock_id=${stockId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener precios del producto');
      const data = await res.json();
      return Array.isArray(data) ? data : (data.results || []);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Guardar precios de un producto (listas 1-4)
  const guardarPreciosProducto = useCallback(async (stockId, precios) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/precios-lista/guardar-precios-producto/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'include',
        body: JSON.stringify({
          stock_id: stockId,
          precios: precios,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar precios del producto');
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Actualizar un precio específico (marca como manual)
  const actualizarPrecio = useCallback(async (precioId, datos) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/productos/precios-lista/${precioId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'include',
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw new Error('Error al actualizar precio');
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    obtenerPreciosProducto,
    guardarPreciosProducto,
    actualizarPrecio,
  };
}
