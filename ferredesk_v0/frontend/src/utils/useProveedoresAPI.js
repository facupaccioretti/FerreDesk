import { useState, useEffect } from 'react';
import { getCookie } from '../utils/csrf';

export function useProveedoresAPI() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchProveedores = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/proveedores/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener proveedores');
      const data = await res.json();
      setProveedores(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      await fetchProveedores();
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
      await fetchProveedores();
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
      if (!res.ok) throw new Error('Error al eliminar proveedor');
      await fetchProveedores();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchProveedores();
  }, []);

  return { proveedores, loading, error, fetchProveedores, addProveedor, updateProveedor, deleteProveedor };
}
