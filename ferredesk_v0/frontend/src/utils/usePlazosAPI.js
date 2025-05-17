import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function usePlazosAPI() {
  const [plazos, setPlazos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchPlazos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/plazos/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener plazos');
      const data = await res.json();
      setPlazos(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPlazo = async (plazo) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/plazos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(plazo)
      });
      if (!res.ok) throw new Error('Error al crear plazo');
      await fetchPlazos();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchPlazos(); }, []);

  return { plazos, loading, error, fetchPlazos, addPlazo, setPlazos };
}
