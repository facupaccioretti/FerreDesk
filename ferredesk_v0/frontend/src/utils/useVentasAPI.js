import { useState, useEffect } from 'react';
import { getCookie } from '../utils/csrf';

export function useVentasAPI() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchVentas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ventas/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener ventas');
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const mapItemFields = (item) => {
    return {
      vdi_orden: item.orden ?? item.vdi_orden,
      vdi_idsto: item.idSto ?? item.vdi_idsto,
      vdi_idpro: item.idPro ?? item.vdi_idpro,
      vdi_cantidad: item.cantidad ?? item.vdi_cantidad,
      vdi_importe: item.importe ?? item.vdi_importe,
      vdi_bonifica: item.bonifica ?? item.bonificacion ?? item.vdi_bonifica,
      vdi_detalle1: item.detalle1 ?? item.vdi_detalle1,
      vdi_detalle2: item.detalle2 ?? item.vdi_detalle2,
      vdi_idaliiva: item.alicuotaIva ?? item.vdi_idaliiva,
    };
  };

  const addVenta = async (venta) => {
    setError(null);
    try {
      let ventaMapped = { ...venta };
      console.log('[useVentasAPI] Valor original de venta.items:', venta.items);
      ventaMapped.items = Array.isArray(venta.items) ? venta.items.map(mapItemFields) : [];
      console.log('[useVentasAPI] Payload mapeado a enviar:', ventaMapped);
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