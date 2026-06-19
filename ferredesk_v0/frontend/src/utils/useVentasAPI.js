import { useCallback, useRef, useState } from 'react';
import { clienteAPI } from './clienteAPI';
import { mapearCamposItem } from '../components/Presupuestos y Ventas/herramientasforms/mapeoItems';

const LIMITE_POR_DEFECTO = 15;

export function useVentasAPI() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    page: 1,
    limit: LIMITE_POR_DEFECTO,
  });
  const ultimaConsultaRef = useRef({
    filtros: {},
    opciones: {
      page: 1,
      limit: LIMITE_POR_DEFECTO,
    },
  });

  const fetchVentas = useCallback(async (filtros = {}, opciones = {}) => {
    setLoading(true);
    setError(null);
    try {
      const page = Number(opciones.page ?? ultimaConsultaRef.current.opciones.page ?? 1);
      const limit = Number(opciones.limit ?? ultimaConsultaRef.current.opciones.limit ?? LIMITE_POR_DEFECTO);
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      params.set('page', String(page));
      params.set('limit', String(limit));

      ultimaConsultaRef.current = {
        filtros: { ...filtros },
        opciones: { page, limit },
      };

      const url = params.toString() ? `/api/ventas/?${params.toString()}` : '/api/ventas/';
      const data = await clienteAPI(url);

      if (Array.isArray(data)) {
        setVentas(data);
        setPagination({
          count: data.length,
          next: null,
          previous: null,
          page,
          limit,
        });
        return data;
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      setVentas(results);
      setPagination({
        count: Number(data?.count ?? results.length),
        next: data?.next ?? null,
        previous: data?.previous ?? null,
        page,
        limit,
      });
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refrescarUltimaConsulta = useCallback(async () => {
    const { filtros, opciones } = ultimaConsultaRef.current;
    return fetchVentas(filtros, opciones);
  }, [fetchVentas]);

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

      await refrescarUltimaConsulta();
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
      await refrescarUltimaConsulta();
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
      await refrescarUltimaConsulta();
    } catch (err) {
      setError(err.message);
    }
  };

  return { ventas, loading, error, pagination, fetchVentas, addVenta, updateVenta, deleteVenta };
}
