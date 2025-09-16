import { useState, useEffect } from 'react';
import { getCookie } from './csrf';
import { mapearCamposItem } from '../components/Presupuestos y Ventas/herramientasforms/mapeoItems';

export function useVentasAPI() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVentas = async (filtros = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Construir querystring a partir de filtros
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      const url = params.toString() ? `/api/ventas/?${params.toString()}` : '/api/ventas/';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener ventas');
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addVenta = async (venta) => {
    setError(null);
    try {
      let ventaMapped = { ...venta };
      
      ventaMapped.items = Array.isArray(venta.items) ? venta.items.map((item, idx) => {
        return mapearCamposItem(item, idx);
      }) : [];
      
      if (!ventaMapped.items || !Array.isArray(ventaMapped.items) || ventaMapped.items.length === 0) {
        console.error('[useVentasAPI] ERROR: El campo items está vacío o ausente en el payload mapeado');
      }
      const csrftoken = getCookie('csrftoken');
      const res = await fetch('/api/ventas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(ventaMapped)
      });
      
      // Obtener la respuesta del backend
      let responseData
      try {
        responseData = await res.json()
      } catch (parseError) {
        // Si no se puede parsear como JSON, es probable que sea HTML (error del servidor)
        console.error('Error parseando respuesta como JSON:', parseError)
        throw new Error('Error al crear venta - Respuesta del servidor no válida')
      }
      
      if (!res.ok) {
        let msg = 'Error al crear venta'
        try {
          msg = responseData.detail || JSON.stringify(responseData)
        } catch {}
        throw new Error(msg)
      }
      
      await fetchVentas();
      
      // Devolver la respuesta del backend para que VentaForm pueda procesar los datos de ARCA
      return responseData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateVenta = async (id, updated) => {
    setError(null);
    try {
      const csrftoken = getCookie('csrftoken');
      const res = await fetch(`/api/ventas/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        let msg = 'Error al editar venta';
        try {
          const data = await res.json();
          msg = data.detail || JSON.stringify(data);
        } catch {}
        throw new Error(msg);
      }
      await fetchVentas();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteVenta = async (id) => {
    setError(null);
    try {
      const csrftoken = getCookie('csrftoken');
      const res = await fetch(`/api/ventas/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar venta');
      await fetchVentas();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, []);

  return { ventas, loading, error, fetchVentas, addVenta, updateVenta, deleteVenta };
} 