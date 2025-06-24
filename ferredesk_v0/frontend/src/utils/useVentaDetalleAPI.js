import { useState, useEffect } from 'react';

// Hook para obtener el detalle calculado de una venta o presupuesto desde las vistas SQL
// Devuelve la cabecera calculada y los ítems calculados
export function useVentaDetalleAPI(idVenta) {
  // Estado para la cabecera calculada de la venta
  const [ventaCalculada, setVentaCalculada] = useState(null);
  // Estado para los ítems calculados de la venta
  const [itemsCalculados, setItemsCalculados] = useState([]);
  // Estado de carga
  const [cargando, setCargando] = useState(false);
  // Estado de error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!idVenta) return;
    setCargando(true);
    setError(null);
    Promise.all([
      fetch(`/api/venta-calculada/${idVenta}/`, { credentials: 'include' }).then(res => {
        if (!res.ok) throw new Error('Error al obtener venta calculada');
        return res.json();
      }),
      fetch(`/api/venta-detalle-item-calculado/?vdi_idve=${idVenta}`, { credentials: 'include' }).then(res => {
        if (!res.ok) throw new Error('Error al obtener ítems calculados');
        return res.json();
      })
    ])
      .then(([venta, items]) => {
        // Si el backend no devuelve comprobante, setearlo como null
        if (!venta.comprobante || typeof venta.comprobante !== 'object') {
          venta.comprobante = null;
        }
        setVentaCalculada(venta);
        setItemsCalculados(items);
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [idVenta]);

  return { ventaCalculada, itemsCalculados, cargando, error };
} 