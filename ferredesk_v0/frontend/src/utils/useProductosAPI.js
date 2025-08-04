import { useState, useEffect, useCallback } from 'react';
import { getCookie } from '../utils/csrf';

export function useProductosAPI() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  // Memoizar fetchProductos para evitar recreación y polling accidental
  const fetchProductos = useCallback(async (filtros = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k,v])=>{
        if (v !== undefined && v !== null && v !== '') params.append(k, v);
      });
      const url = params.toString() ? `/api/productos/stock/?${params.toString()}` : '/api/productos/stock/';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener productos');
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Dependencias vacías: nunca se recrea

  // Las funciones que dependen de fetchProductos deben usar la referencia memoizada
  const addProducto = useCallback(async (producto) => {
    setError(null);
    try {
      const res = await fetch('/api/productos/stock/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(producto)
      });
      if (!res.ok) {
        let msg = 'Error al crear producto';
        try {
          const data = await res.json();
          msg = data.detail || JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }
      await fetchProductos();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [csrftoken, fetchProductos]);

  const updateProducto = useCallback(async (id, updated) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/stock/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        let msg = 'Error al editar producto';
        try {
          const data = await res.json();
          msg = data.detail || JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }
      await fetchProductos();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [csrftoken, fetchProductos]);

  const deleteProducto = useCallback(async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/stock/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar producto');
      await fetchProductos();
    } catch (err) {
      setError(err.message);
    }
  }, [csrftoken, fetchProductos]);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  return { productos, loading, error, fetchProductos, addProducto, updateProducto, deleteProducto, setProductos };
}
