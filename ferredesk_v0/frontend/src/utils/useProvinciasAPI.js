import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useProvinciasAPI() {
  const [provincias, setProvincias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchProvincias = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/provincias/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener provincias');
      const data = await res.json();
      setProvincias(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addProvincia = async (provincia) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/provincias/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(provincia)
      });
      if (!res.ok) throw new Error('Error al crear provincia');
      await fetchProvincias();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchProvincias(); }, []);

  return { provincias, loading, error, fetchProvincias, addProvincia, setProvincias };
}
