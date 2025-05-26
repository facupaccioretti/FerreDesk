import { useState, useEffect } from 'react';

export function useComprobantesAPI() {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComprobantes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/comprobantes/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener comprobantes');
      const data = await res.json();
      setComprobantes(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComprobantes(); }, []);

  return { comprobantes, loading, error, fetchComprobantes, setComprobantes };
}
