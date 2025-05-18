import { useState, useEffect } from 'react';
import { getCookie } from './csrf';

export function useCategoriasAPI() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchCategorias = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/categorias/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener categorías');
      const data = await res.json();
      setCategorias(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCategoria = async (categoria) => {
    setError(null);
    try {
      const res = await fetch('/api/clientes/categorias/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(categoria)
      });
      if (!res.ok) throw new Error('Error al crear categoría');
      await fetchCategorias();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  return { categorias, loading, error, fetchCategorias, addCategoria, setCategorias };
}
