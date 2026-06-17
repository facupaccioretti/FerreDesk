import { useState, useEffect, useCallback, useRef } from 'react';
import { clienteAPI } from './clienteAPI';

export function useProveedoresAPI() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const lastQueryKeyRef = useRef('');
  const [parametrosActuales, setParametrosActuales] = useState({
    page: 1,
    limit: 10,
    filtros: {},
    orden: 'id',
    direccion: 'desc',
  });

  const fetchProveedores = useCallback(async (page = 1, limit = 10, filtros = {}, orden = 'id', direccion = 'desc', forzar = false) => {
    setError(null);
    try {
      setParametrosActuales({ page, limit, filtros, orden, direccion });

      const params = new URLSearchParams();
      Object.entries(filtros || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (orden) params.append('orden', orden);
      if (direccion) params.append('direccion', direccion);

      const query = params.toString();
      const url = query ? `/api/productos/proveedores/?${query}` : '/api/productos/proveedores/';
      const key = `GET ${url}`;
      if (!forzar && lastQueryKeyRef.current === key) return;

      lastQueryKeyRef.current = key;
      setLoading(true);
      const data = await clienteAPI(url);
      const lista = Array.isArray(data) ? data : (data.results || []);
      setProveedores(lista);
      setTotal((Array.isArray(data) ? lista.length : (typeof data.count === 'number' ? data.count : lista.length)) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refrescarProveedores = async () => {
    await fetchProveedores(
      parametrosActuales.page,
      parametrosActuales.limit,
      parametrosActuales.filtros,
      parametrosActuales.orden,
      parametrosActuales.direccion,
      true
    );
  };

  const addProveedor = async (proveedor) => {
    setError(null);
    try {
      await clienteAPI('/api/productos/proveedores/', {
        method: 'POST',
        body: proveedor,
      });
      await refrescarProveedores();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProveedor = async (id, updated) => {
    setError(null);
    try {
      await clienteAPI(`/api/productos/proveedores/${id}/`, {
        method: 'PUT',
        body: updated,
      });
      await refrescarProveedores();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteProveedor = async (id) => {
    setError(null);
    try {
      await clienteAPI(`/api/productos/proveedores/${id}/`, {
        method: 'DELETE',
      });
      await refrescarProveedores();
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
