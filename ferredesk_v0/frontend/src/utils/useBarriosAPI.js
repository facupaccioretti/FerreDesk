import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useBarriosAPI() {
  const [barrios, setBarrios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchBarrios = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/barrios/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener barrios');
      const data = await res.json();
      setBarrios(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addBarrio = async (barrio) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/barrios/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(barrio)
      });
      if (!res.ok) throw new Error('Error al crear barrio');
      await fetchBarrios();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchBarrios(); }, []);

  return { barrios, loading, error, fetchBarrios, addBarrio, setBarrios };
}
