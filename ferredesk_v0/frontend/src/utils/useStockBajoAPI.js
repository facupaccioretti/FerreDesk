import { useState } from 'react';
import { fechaHoyLocal } from './fechas';

export const useStockBajoAPI = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalProductos, setTotalProductos] = useState(0);

  const construirQuery = (parametros = {}) => {
    const params = new URLSearchParams()
    Object.entries(parametros).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const query = params.toString()
    return query ? `?${query}` : ''
  }

  const obtenerProductosStockBajo = async (parametros = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/informes/stock-bajo/${construirQuery(parametros)}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener datos de stock bajo');
      }
      
      const data = await response.json();
      const lista = Array.isArray(data) ? data : (data.results || [])
      setProductos(lista);
      setTotalProductos(typeof data.count === 'number' ? data.count : lista.length);
    } catch (err) {
      setError(err.message);
      setProductos([]);
      setTotalProductos(0);
    } finally {
      setLoading(false);
    }
  };

  const generarPDF = async (parametros = {}) => {
    try {
      const response = await fetch(`/api/informes/stock-bajo/pdf/${construirQuery(parametros)}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al generar PDF');
      }
      
      // Crear blob y descargar
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_stock_bajo_${fechaHoyLocal()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const limpiarResultados = () => {
    setProductos([])
    setTotalProductos(0)
    setError(null)
  }

  return {
    productos,
    loading,
    error,
    totalProductos,
    obtenerProductosStockBajo,
    generarPDF,
    limpiarResultados
  };
}; 
