import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useVendedoresAPI() {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchVendedores = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/vendedores/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener vendedores');
      const data = await res.json();
      setVendedores(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addVendedor = async (vendedor) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/vendedores/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(vendedor)
      });
      if (!res.ok) throw new Error('Error al crear vendedor');
      await fetchVendedores();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateVendedor = async (vendedor) => {
    setError(null);
    try {
      const res = await fetch(`/api/clientes/vendedores/${vendedor.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(vendedor)
      });
      if (!res.ok) throw new Error('Error al editar vendedor');
      await fetchVendedores();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchVendedores(); }, []);

  return { vendedores, loading, error, fetchVendedores, addVendedor, updateVendedor, setVendedores };
}
