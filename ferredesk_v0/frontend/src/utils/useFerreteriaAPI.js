import { useState, useEffect } from 'react';

export function useFerreteriaAPI() {
  const [ferreteria, setFerreteria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFerreteria = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ferreteria/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener configuración de ferretería');
      const data = await res.json();
      setFerreteria(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFerreteria();
  }, []);

  return { ferreteria, loading, error, fetchFerreteria };
} 