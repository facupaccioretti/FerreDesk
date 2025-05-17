import { useState, useEffect } from 'react';

export function useAlicuotasIVAAPI() {
  const [alicuotas, setAlicuotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAlicuotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/alicuotasiva/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener alícuotas de IVA');
      const data = await res.json();
      setAlicuotas(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlicuotas();
  }, []);

  return { alicuotas, loading, error, fetchAlicuotas };
} 