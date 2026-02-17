import { useState, useEffect } from 'react';
import { fechaHoyLocal } from './fechas';

export const useStockBajoAPI = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalProductos, setTotalProductos] = useState(0);

  const obtenerProductosStockBajo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/informes/stock-bajo/', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener datos de stock bajo');
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setProductos(data.data);
        setTotalProductos(data.total_productos);
      } else {
        throw new Error(data.message || 'Error en la respuesta del servidor');
      }
    } catch (err) {
      setError(err.message);
      setProductos([]);
      setTotalProductos(0);
    } finally {
      setLoading(false);
    }
  };

  const generarPDF = async () => {
    try {
      const response = await fetch('/api/informes/stock-bajo/pdf/', {
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

  useEffect(() => {
    obtenerProductosStockBajo();
  }, []);

  return {
    productos,
    loading,
    error,
    totalProductos,
    obtenerProductosStockBajo,
    generarPDF
  };
}; 