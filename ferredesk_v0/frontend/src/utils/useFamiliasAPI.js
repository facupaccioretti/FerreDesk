import { useState, useEffect } from 'react';
import { getCookie } from '../utils/csrf';

export function useFamiliasAPI() {
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchFamilias = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/familias/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener familias');
      const data = await res.json();
      setFamilias(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addFamilia = async (familia) => {
    setError(null);
    try {
      const res = await fetch('/api/productos/familias/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(familia)
      });
      if (!res.ok) throw new Error('Error al crear familia');
      await fetchFamilias();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateFamilia = async (id, updated) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/familias/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Error al editar familia');
      await fetchFamilias();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteFamilia = async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/familias/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar familia');
      await fetchFamilias();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchFamilias();
  }, []);

  return { familias, loading, error, fetchFamilias, addFamilia, updateFamilia, deleteFamilia };
}
