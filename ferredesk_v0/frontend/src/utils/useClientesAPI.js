import { useState, useEffect, useCallback, useRef } from 'react';
import { clienteAPI } from './clienteAPI';

export function useClientesAPI(filtrosIniciales = {}, opciones = { autoFetch: true }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(!opciones.autoFetch);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const lastQueryKeyRef = useRef('');

  const fetchClientes = useCallback(async (filtros = {}, page = 1, limit = 10, orden = 'id', direccion = 'desc') => {
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));
      if (orden) params.append('orden', orden);
      if (direccion) params.append('direccion', direccion);

      const query = params.toString();
      const url = query ? `/api/clientes/clientes/?${query}` : '/api/clientes/clientes/';
      const key = `GET ${url}`;
      if (lastQueryKeyRef.current === key) return;

      lastQueryKeyRef.current = key;
      setLoading(true);
      const data = await clienteAPI(url);
      const lista = Array.isArray(data) ? data : (data.results || []);
      setClientes(lista);
      setTotal((Array.isArray(data) ? lista.length : (typeof data.count === 'number' ? data.count : lista.length)) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addCliente = useCallback(async (cliente) => {
    setError(null);
    try {
      await clienteAPI('/api/clientes/clientes/', {
        method: 'POST',
        body: cliente,
      });
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [fetchClientes]);

  const updateCliente = useCallback(async (id, updated) => {
    setError(null);
    try {
      await clienteAPI(`/api/clientes/clientes/${id}/`, {
        method: 'PUT',
        body: updated,
      });
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [fetchClientes]);

  const deleteCliente = useCallback(async (id) => {
    setError(null);
    try {
      await clienteAPI(`/api/clientes/clientes/${id}/`, {
        method: 'DELETE',
      });
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [fetchClientes]);

  const fetchClientePorDefecto = useCallback(async () => {
    setLoading(true);
    try {
      return await clienteAPI('/api/clientes/clientes/cliente_por_defecto/');
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (opciones && opciones.autoFetch) {
      fetchClientes(filtrosIniciales);
    }
  }, [fetchClientes, filtrosIniciales, opciones]);

  return { clientes, total, loading, error, fetchClientes, addCliente, updateCliente, deleteCliente, fetchClientePorDefecto, clearError };
}
