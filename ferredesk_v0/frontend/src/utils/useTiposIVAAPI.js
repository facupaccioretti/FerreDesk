import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useTiposIVAAPI() {
  const [tiposIVA, setTiposIVA] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchTiposIVA = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/tiposiva/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener tipos de IVA');
      const data = await res.json();
      setTiposIVA(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addTipoIVA = async (tipoIVA) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/tiposiva/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(tipoIVA)
      });
      if (!res.ok) throw new Error('Error al crear tipo de IVA');
      await fetchTiposIVA();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchTiposIVA(); }, []);

  return { tiposIVA, loading, error, fetchTiposIVA, addTipoIVA, setTiposIVA };
}
