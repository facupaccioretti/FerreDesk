import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useTransportesAPI() {
  const [transportes, setTransportes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchTransportes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/transportes/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener transportes');
      const data = await res.json();
      setTransportes(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTransporte = async (transporte) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/transportes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(transporte)
      });
      if (!res.ok) throw new Error('Error al crear transporte');
      await fetchTransportes();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchTransportes(); }, []);

  return { transportes, loading, error, fetchTransportes, addTransporte, setTransportes };
}
