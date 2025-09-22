import { useState, useEffect, useCallback, useRef } from 'react';
import { getCookie } from '../utils/csrf';

export function useProveedoresAPI() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const csrftoken = getCookie('csrftoken');
  const lastQueryKeyRef = useRef('');
  
  // Almacenar parámetros actuales para refrescar con los mismos filtros
  const [parametrosActuales, setParametrosActuales] = useState({
    page: 1,
    limit: 10,
    filtros: {},
    orden: 'id',
    direccion: 'desc'
  });

  const fetchProveedores = useCallback(async (page = 1, limit = 10, filtros = {}, orden = 'id', direccion = 'desc', forzar = false) => {
    setError(null);
    try {
      // Actualizar parámetros actuales para futuras operaciones CRUD
      setParametrosActuales({ page, limit, filtros, orden, direccion });
      
      const params = new URLSearchParams();
      Object.entries(filtros || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.append(k, v);
      });
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (orden) params.append('orden', orden);
      if (direccion) params.append('direccion', direccion);
      const query = params.toString();
      const url = query ? `/api/productos/proveedores/?${query}` : '/api/productos/proveedores/';
      const key = `GET ${url}`;
      if (!forzar && lastQueryKeyRef.current === key) {
        return; // Evitar fetch redundante idéntico
      }
      lastQueryKeyRef.current = key;
      setLoading(true);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener proveedores');
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.results || []);
      setProveedores(lista);
      setTotal((Array.isArray(data) ? lista.length : (typeof data.count === 'number' ? data.count : lista.length)) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addProveedor = async (proveedor) => {
    setError(null);
    try {
      const res = await fetch('/api/productos/proveedores/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(proveedor)
      });
      if (!res.ok) {
        let msg = 'Error al crear proveedor';
        try {
          const data = await res.json();
          if (data.detail) msg = data.detail;
          else if (typeof data === 'object') msg = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
          else msg = JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }
      // Refrescar con los parámetros actuales para mantener filtros y paginación
      await fetchProveedores(
        parametrosActuales.page, 
        parametrosActuales.limit, 
        parametrosActuales.filtros, 
        parametrosActuales.orden, 
        parametrosActuales.direccion,
        true
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProveedor = async (id, updated) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/proveedores/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        let msg = 'Error al editar proveedor';
        try {
          const data = await res.json();
          if (data.detail) msg = data.detail;
          else if (typeof data === 'object') msg = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
          else msg = JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }
      // Refrescar con los parámetros actuales para mantener filtros y paginación
      await fetchProveedores(
        parametrosActuales.page, 
        parametrosActuales.limit, 
        parametrosActuales.filtros, 
        parametrosActuales.orden, 
        parametrosActuales.direccion,
        true
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteProveedor = async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/proveedores/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) {
        let errorMsg = 'Error al eliminar proveedor';
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
      // Refrescar con los parámetros actuales para mantener filtros y paginación
      await fetchProveedores(
        parametrosActuales.page, 
        parametrosActuales.limit, 
        parametrosActuales.filtros, 
        parametrosActuales.orden, 
        parametrosActuales.direccion,
        true
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchProveedores(1, 10);
  }, [fetchProveedores]);

  return { proveedores, total, loading, error, fetchProveedores, addProveedor, updateProveedor, deleteProveedor };
}
