import { useQuery } from '@tanstack/react-query';
import { fechaHoyLocal } from './fechas';

export const construirQuery = (parametros = {}) => {
  const params = new URLSearchParams()
  Object.entries(parametros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const fetchStockBajo = async (parametros) => {
  const response = await fetch(`/api/informes/stock-bajo/${construirQuery(parametros)}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error('Error al obtener datos de stock bajo');
  }
  const data = await response.json();
  const lista = Array.isArray(data) ? data : (data.results || []);
  const count = typeof data.count === 'number' ? data.count : lista.length;
  return { productos: lista, totalProductos: count };
};

export const useStockBajoQuery = (parametros = {}, enabled = true) => {
  return useQuery({
    queryKey: ['stock-bajo', parametros],
    queryFn: () => fetchStockBajo(parametros),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};

export const generarPDFStockBajo = async (parametros = {}) => {
  try {
    const response = await fetch(`/api/informes/stock-bajo/pdf/${construirQuery(parametros)}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Error al generar PDF');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_stock_bajo_${fechaHoyLocal()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
