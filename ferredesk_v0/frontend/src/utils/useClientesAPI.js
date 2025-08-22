import { useState, useEffect, useCallback, useRef } from 'react';
import { getCookie } from './csrf';

export function useClientesAPI(filtrosIniciales = {}, opciones = { autoFetch: true }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const csrftoken = getCookie('csrftoken');
  const lastQueryKeyRef = useRef('');

  const fetchClientes = useCallback(async (filtros = {}, page = 1, limit = 10, orden = 'id', direccion = 'desc') => {
    setError(null);
    try {
      // Construir querystring si hay filtros
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
      if (lastQueryKeyRef.current === key) {
        return; // Evitar fetch redundante idéntico
      }
      lastQueryKeyRef.current = key;
      setLoading(true);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener clientes');
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.results || []);
      setClientes(lista);
      setTotal((Array.isArray(data) ? lista.length : (typeof data.count === 'number' ? data.count : lista.length)) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Dependencias vacías: nunca se recrea

  const addCliente = useCallback(async (cliente) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/clientes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(cliente)
      });
      if (!res.ok) {
        let errorMsg = 'Error al crear cliente';
        try {
          const data = await res.json();
          errorMsg = data.detail || JSON.stringify(data);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [csrftoken, fetchClientes]);

  const updateCliente = useCallback(async (id, updated) => {
    setError(null);
    try {
      const res = await fetch(`/api/clientes/clientes/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        let errorMsg = 'Error al editar cliente';
        try {
          const data = await res.json();
          errorMsg = data.detail || JSON.stringify(data);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [csrftoken, fetchClientes]);

  const deleteCliente = useCallback(async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/clientes/clientes/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) {
        let errorMsg = 'Error al eliminar cliente';
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
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [csrftoken, fetchClientes]);

  const fetchClientePorDefecto = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/clientes/clientes/cliente_por_defecto/');
      if (!response.ok) throw new Error('Error al cargar cliente por defecto');
      const data = await response.json();
      return data;
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
