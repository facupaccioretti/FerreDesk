import { useState, useEffect } from 'react';
import { getCookie } from '../utils/csrf';
import { mapearCamposItem } from '../components/Presupuestos y Ventas/herramientasforms/mapeoItems';

export function useVentasAPI() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

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
      console.log('[addVenta] Ítems antes de mapear:', venta.items);
      ventaMapped.items = Array.isArray(venta.items) ? venta.items.map((item, idx) => {
        console.log('[addVenta] Ítem recibido para mapear:', item, 'idx:', idx);
        return mapearCamposItem(item, idx);
      }) : [];
      console.log('[addVenta] Payload mapeado a enviar:', ventaMapped);
      if (!ventaMapped.items || !Array.isArray(ventaMapped.items) || ventaMapped.items.length === 0) {
        console.error('[useVentasAPI] ERROR: El campo items está vacío o ausente en el payload mapeado');
      } else {
        console.log('[useVentasAPI] Primer ítem del array items:', ventaMapped.items[0]);
      }
      const res = await fetch('/api/ventas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(ventaMapped)
      });
      if (!res.ok) {
        let msg = 'Error al crear venta';
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

  const updateVenta = async (id, updated) => {
    setError(null);
    try {
      const res = await fetch(`/api/ventas/${id}/`, {
        method: 'PUT',
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