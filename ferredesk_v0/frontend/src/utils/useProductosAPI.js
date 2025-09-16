import { useState, useEffect, useCallback } from 'react';
import { getCookie } from '../utils/csrf';

export function useProductosAPI() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const csrftoken = getCookie('csrftoken');

  // Memoizar fetchProductos para evitar recreación y polling accidental
  const fetchProductos = useCallback(async (filtros = {}, page = 1, limit = 10, orden = 'id', direccion = 'desc') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // Si el filtro no trae 'acti', lo agrego como 'S' por defecto
      const filtrosConActi = { ...filtros };
      if (!('acti' in filtrosConActi)) {
        filtrosConActi.acti = 'S'; // Solo productos activos por defecto
      }
      Object.entries(filtrosConActi).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.append(k, v);
      });
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (orden) params.append('orden', orden);
      if (direccion) params.append('direccion', direccion);
      const url = params.toString() ? `/api/productos/stock/?${params.toString()}` : '/api/productos/stock/';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener productos');
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.results || []);
      setProductos(lista);
      setTotal((Array.isArray(data) ? lista.length : (typeof data.count === 'number' ? data.count : lista.length)) || 0);
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
      // Usar el endpoint correcto para editar productos con relaciones
      const url = `/api/productos/editar-producto-con-relaciones/`;
      
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify({
          producto: updated,
          stock_proveedores: updated.stock_proveedores || []
        })
      });
      if (!res.ok) {
        let errorMsg = 'Error al editar producto';
        try {
          const data = await res.json();
          // Manejo específico para errores de validación de campos anidados como codvta
          if (data.errors && data.errors.errors && data.errors.errors.codvta && data.errors.errors.codvta.length > 0) {
            errorMsg = data.errors.errors.codvta[0];
          } 
          // Manejo para errores de protección más simples
          else if (data.error) {
            errorMsg = data.error;
          }
          // Fallback para otros formatos de error de DRF
          else {
            errorMsg = data.detail || JSON.stringify(data);
          }
        } catch (e) {
          // Si la respuesta no es JSON o está vacía
          errorMsg = res.statusText || 'Ocurrió un error desconocido.';
        }
        throw new Error(errorMsg);
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
      if (!res.ok) {
        let errorMsg = 'Error al eliminar producto';
        try {
          const data = await res.json();
          // Manejo específico para el error de restricción de movimientos comerciales
          if (data.error && data.error.includes('movimientos comerciales')) {
            errorMsg = data.error;
          } else {
            errorMsg = data.detail || data.error || JSON.stringify(data);
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchProductos();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [csrftoken, fetchProductos]);

  useEffect(() => {
    fetchProductos({}, 1, 10);
  }, [fetchProductos]);

  return { productos, total, loading, error, fetchProductos, addProducto, updateProducto, deleteProducto, setProductos };
}
