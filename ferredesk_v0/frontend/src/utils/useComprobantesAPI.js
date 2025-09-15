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

  const getComprobanteByTipo = async (tipo) => {
    try {
      const res = await fetch(`/api/comprobantes/?tipo=${tipo}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener comprobante');
      const data = await res.json();
      return Array.isArray(data) ? data[0] : (data.results && data.results[0]);
    } catch (err) {
      console.error('Error al obtener comprobante por tipo:', err);
      return null;
    }
  };

  return { comprobantes, loading, error, fetchComprobantes, setComprobantes, getComprobanteByTipo };
}
