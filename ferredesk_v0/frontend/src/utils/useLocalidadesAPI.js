import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useLocalidadesAPI() {
  const [localidades, setLocalidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchLocalidades = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/localidades/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener localidades');
      const data = await res.json();
      setLocalidades(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addLocalidad = async (localidad) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/localidades/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(localidad)
      });
      if (!res.ok) throw new Error('Error al crear localidad');
      await fetchLocalidades();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchLocalidades(); }, []);

  return { localidades, loading, error, fetchLocalidades, addLocalidad, setLocalidades };
}
