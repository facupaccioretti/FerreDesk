import { useState, useCallback } from 'react';
import { getCookie } from './csrf';

export function useLibroIvaAPI() {
  const [libroIva, setLibroIva] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validaciones, setValidaciones] = useState({ errores: [], advertencias: [] });
  
  const csrftoken = getCookie('csrftoken');

  const generarLibroIva = useCallback(async (mes, anio) => {
    setLoading(true);
    setError(null);
    setValidaciones({ errores: [], advertencias: [] });
    
    try {
      const response = await fetch('/api/libro-iva-ventas/generar/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
        body: JSON.stringify({ mes, anio })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al generar el libro IVA');
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setLibroIva(data.data);
        setValidaciones(data.validaciones || { errores: [], advertencias: [] });
        return data.data;
      } else {
        throw new Error(data.message || 'Error desconocido');
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [csrftoken]);

  const obtenerEstadisticas = useCallback(async (mes, anio) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/libro-iva-ventas/estadisticas/?mes=${mes}&anio=${anio}`, {
        method: 'GET',
        headers: {
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al obtener estadísticas');
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        return data;
      } else {
        throw new Error(data.message || 'Error desconocido');
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [csrftoken]);

  const exportarLibroIva = useCallback(async (formato, mes, anio) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/libro-iva-ventas/export/${formato}/?mes=${mes}&anio=${anio}`, {
        method: 'GET',
        headers: {
          'X-CSRFToken': csrftoken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al exportar ${formato.toUpperCase()}`);
      }

      // Crear blob y descargar archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = formato === 'excel' ? 'xlsx' : formato;
      a.download = `Libro_IVA_Ventas_${mes.toString().padStart(2, '0')}${anio}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [csrftoken]);

  const limpiarLibroIva = useCallback(() => {
    setLibroIva(null);
    setError(null);
    setValidaciones({ errores: [], advertencias: [] });
  }, []);

  return {
    libroIva,
    loading,
    error,
    validaciones,
    generarLibroIva,
    obtenerEstadisticas,
    exportarLibroIva,
    limpiarLibroIva,
  };
}