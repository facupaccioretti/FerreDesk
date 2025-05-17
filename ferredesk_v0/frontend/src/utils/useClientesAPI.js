import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useClientesAPI() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/clientes/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener clientes');
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCliente = async (cliente) => {
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
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCliente = async (id, updated) => {
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
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCliente = async (id) => {
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
          errorMsg = data.detail || JSON.stringify(data);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchClientes();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  return { clientes, loading, error, fetchClientes, addCliente, updateCliente, deleteCliente };
}
