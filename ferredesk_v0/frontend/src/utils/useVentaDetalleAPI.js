import { useState, useEffect } from 'react';

// Hook para obtener el detalle calculado de una venta o presupuesto desde las vistas SQL
// Devuelve la cabecera calculada, los ítems calculados y el IVA discriminado
export function useVentaDetalleAPI(idVenta) {
  // Estado para la cabecera calculada de la venta
  const [ventaCalculada, setVentaCalculada] = useState(null);
  // Estado para los ítems calculados de la venta
  const [itemsCalculados, setItemsCalculados] = useState([]);
  // Estado para el IVA discriminado por alícuota
  const [ivaDiscriminado, setIvaDiscriminado] = useState([]);
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
      }),
      fetch(`/api/venta-iva-alicuota/?vdi_idve=${idVenta}`, { credentials: 'include' }).then(res => {
        if (!res.ok) throw new Error('Error al obtener IVA discriminado');
        return res.json();
      })
    ])
      .then(([venta, items, iva]) => {
        // Si el backend no devuelve comprobante, setearlo como null
        if (!venta.comprobante || typeof venta.comprobante !== 'object') {
          venta.comprobante = null;
        }
        setVentaCalculada(venta);
        setItemsCalculados(items);
        setIvaDiscriminado(iva);
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [idVenta]);

  return { ventaCalculada, itemsCalculados, ivaDiscriminado, cargando, error };
} 