import { useState, useEffect } from 'react';
import { clienteAPI } from './clienteAPI';
import { mapearCamposItem } from '../components/Presupuestos y Ventas/herramientasforms/mapeoItems';

export function useVentasAPI() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVentas = async (filtros = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      const url = params.toString() ? `/api/ventas/?${params.toString()}` : '/api/ventas/';
      const data = await clienteAPI(url);
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
      const ventaMapped = {
        ...venta,
        items: Array.isArray(venta.items) ? venta.items.map((item, idx) => mapearCamposItem(item, idx)) : [],
      };

      if (!ventaMapped.items || ventaMapped.items.length === 0) {
        console.error('[useVentasAPI] ERROR: El campo items esta vacio o ausente en el payload mapeado');
      }

      const responseData = await clienteAPI('/api/ventas/', {
        method: 'POST',
        body: ventaMapped,
      });

      await fetchVentas();
      return responseData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateVenta = async (id, updated) => {
    setError(null);
    try {
      await clienteAPI(`/api/ventas/${id}/`, {
        method: 'PATCH',
        body: updated,
      });
      await fetchVentas();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteVenta = async (id) => {
    setError(null);
    try {
      await clienteAPI(`/api/ventas/${id}/`, {
        method: 'DELETE',
      });
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
