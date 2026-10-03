import { useMemo, useCallback } from 'react';

export function calcularImporteConDescuentos(item, importe, { bonificacionGeneral = 0, descu1 = 0, descu2 = 0, descu3 = 0 } = {}) {
  if (item.tipo === 'promocion') return importe;

  const bonifParticular = Number.parseFloat(item.bonificacion ?? item.vdi_bonifica);
  const bonificacion = Number.isFinite(bonifParticular) && bonifParticular > 0
    ? bonifParticular
    : (Number.parseFloat(bonificacionGeneral) || 0);
  let total = importe * (1 - bonificacion / 100);
  if (descu1 > 0) total *= (1 - descu1 / 100);
  if (descu2 > 0) total *= (1 - descu2 / 100);
  if (descu3 > 0) total *= (1 - descu3 / 100);
  return total;
}

/**
 * Hook que centraliza la lógica de cálculos compartida entre formularios (VentaForm, PresupuestoForm, etc.)
 * @param {Array} items - Array de items del formulario
 * @param {Object} params - Parámetros de cálculo
 * @param {number} params.bonificacionGeneral - Bonificación general del formulario
 * @param {number} params.descu1 - Primer descuento
 * @param {number} params.descu2 - Segundo descuento
 * @param {number} params.descu3 - Tercer descuento
 * @param {Object} params.alicuotas - Mapa de alicuotas de IVA
 * @returns {Object} - Objeto con funciones de cálculo y resultados
 */
export const useCalculosFormulario = (items, { bonificacionGeneral, descu1, descu2, descu3, alicuotas }) => {
  // Obtiene el ID de alícuota del ítem
  const obtenerAliId = useCallback((item) => {
    return (
      item.alicuotaIva ??
      item.vdi_idaliiva ??
      item.idaliiva ??
      (item.producto && (item.producto.idaliiva?.id ?? item.producto.idaliiva)) ??
      0
    );
  }, []);

  // Derivar SIEMPRE precio base SIN IVA a partir del precio final si existe
  const obtenerPrecioBaseSinIVA = useCallback((item) => {
    const rawPrecioFinal = item.vdi_precio_unitario_final ?? item.precioFinal;
    const rawPrecioBase = item.precio;

    // 1) Si viene precio final explícito (aunque sea 0 o "0"), derivar base dividiendo por (1 + IVA)
    if (rawPrecioFinal !== undefined && rawPrecioFinal !== null && rawPrecioFinal !== "") {
      const precioFinal = Number.parseFloat(rawPrecioFinal);
      if (Number.isFinite(precioFinal)) {
        const aliId = obtenerAliId(item);
        const aliPorc = (alicuotas?.[aliId] ?? 0);
        const divisor = 1 + (aliPorc / 100);
        return divisor > 0 ? precioFinal / divisor : 0;
      }
    }

    // 2) Si no hay final pero hay precio base explícito (aunque sea 0)
    if (rawPrecioBase !== undefined && rawPrecioBase !== null && rawPrecioBase !== "") {
      const precioPosibleBase = Number.parseFloat(rawPrecioBase);
      if (Number.isFinite(precioPosibleBase)) {
        return precioPosibleBase;
      }
    }

    // 3) Último recurso: usar costo si los campos de precio están realmente ausentes (nulos/indefinidos)
    const costo = Number.parseFloat(item.costo ?? item.vdi_costo);
    return Number.isFinite(costo) ? costo : 0;
  }, [alicuotas, obtenerAliId]);

  // Cálculo de subtotal base a partir del precio base sin IVA
  const calcularSubtotal = useCallback((item) => {
    const cantidad = Number.parseFloat(item.cantidad ?? item.vdi_cantidad) || 0;
    const precioBase = obtenerPrecioBaseSinIVA(item) || 0;
    return cantidad * precioBase;
  }, [obtenerPrecioBaseSinIVA]);

  // Cálculo de bonificación
  const calcularBonificacion = useCallback((item) => {
    const subtotal = calcularSubtotal(item);
    return subtotal - calcularImporteConDescuentos(item, subtotal, { bonificacionGeneral });
  }, [calcularSubtotal, bonificacionGeneral]);

  // Subtotal neto tras bonificación
  const calcularSubtotalNeto = useCallback((item) => {
    const subtotal = calcularSubtotal(item);
    return calcularImporteConDescuentos(item, subtotal, { bonificacionGeneral });
  }, [calcularSubtotal, bonificacionGeneral]);

  const calcularSubtotalConDescuentos = useCallback((item) => {
    return calcularImporteConDescuentos(item, calcularSubtotal(item), {
      bonificacionGeneral,
      descu1,
      descu2,
      descu3,
    });
  }, [calcularSubtotal, bonificacionGeneral, descu1, descu2, descu3]);

  // Cálculo de descuentos escalonados sobre el subtotal neto
  const calcularDescuento = (item) => {
    return calcularSubtotalNeto(item) - calcularSubtotalConDescuentos(item);
  };

  // Cálculo de alícuota de IVA robusto (reutiliza obtenerAliId)

  // Cálculo de IVA
  const calcularIVA = useCallback((item) => {
    const aliId = obtenerAliId(item);
    const aliPorc = alicuotas[aliId] || 0;
    return calcularSubtotalConDescuentos(item) * (aliPorc / 100);
  }, [alicuotas, calcularSubtotalConDescuentos, obtenerAliId]);

  // Cálculo de total por línea
  const calcularTotal = useCallback((item) => {
    return calcularSubtotalConDescuentos(item) + calcularIVA(item);
  }, [calcularSubtotalConDescuentos, calcularIVA]);

  // Cálculo de totales generales
  const calcularTotalesGenerales = useCallback(() => {
    const subtotalSinIva = items.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    // Sumar netos tras bonificación
    const subtotalNeto = items.reduce((sum, item) => sum + calcularSubtotalNeto(item), 0);
    // Sumar descuentos sobre netos
    const subtotalConDescuentos = items.reduce((sum, item) => sum + calcularSubtotalConDescuentos(item), 0);
    const ivaTotal = items.reduce((sum, item) => sum + calcularIVA(item), 0);
    const total = items.reduce((sum, item) => sum + calcularTotal(item), 0);
    return {
      subtotal: subtotalSinIva,
      subtotalNeto,
      subtotalConDescuentos,
      iva: ivaTotal,
      total
    };
  }, [items, calcularSubtotal, calcularSubtotalNeto, calcularSubtotalConDescuentos, calcularIVA, calcularTotal]);

  // Memoizar cálculos
  const totales = useMemo(() => calcularTotalesGenerales(), [calcularTotalesGenerales]);

  return {
    totales,
    calcularSubtotal,
    calcularBonificacion,
    calcularDescuento,
    calcularIVA,
    calcularTotal
  };
};

// Helper para calcular el precio unitario sin IVA
export function calcularPrecioUnitarioSinIVA(item) {
  const costo = parseFloat(item.costo ?? item.vdi_costo) || 0;
  const margen = parseFloat(item.margen ?? item.vdi_margen) || 0;
  return costo * (1 + margen / 100);
}

// Helper para calcular el precio unitario con IVA
export function calcularPrecioUnitarioConIVA(item, alicuotas) {
  const precioSinIVA = calcularPrecioUnitarioSinIVA(item);
  const aliId = item.alicuotaIva ?? item.vdi_idaliiva ?? item.idaliiva ?? (item.producto && (item.producto.idaliiva?.id ?? item.producto.idaliiva)) ?? 0;
  const aliPorc = alicuotas?.[aliId] || 0;
  return precioSinIVA * (1 + aliPorc / 100);
}

// Helper para calcular el total de la línea (precio unitario con IVA * cantidad)
export function calcularTotalLinea(item, alicuotas) {
  const precioUnitarioConIVA = calcularPrecioUnitarioConIVA(item, alicuotas);
  const cantidad = parseFloat(item.cantidad ?? item.vdi_cantidad) || 0;
  return precioUnitarioConIVA * cantidad;
}

/**
 * Componente visual para mostrar los totales y descuentos de la venta/presupuesto.
 * Centraliza la visualización para todos los formularios.
 * @param {Object} props
 * @param {number} bonificacionGeneral - Bonificación general aplicada
 * @param {number} descu1 - Primer descuento
 * @param {number} descu2 - Segundo descuento
 * @param {number} descu3 - Tercer descuento (opcional)
 * @param {Object} totales - Objeto de totales calculados
 * @returns {JSX.Element}
 */

export function TotalesVisualizacion({ bonificacionGeneral = 0, descu1 = 0, descu2 = 0, descu3 = 0, totales = {} }) {
  return (
    <div className="mt-4 flex w-full justify-center">
      <div className="w-full max-w-3xl bg-gradient-to-r from-slate-50 via-slate-100/80 to-slate-50 rounded-md shadow-sm border border-slate-300/50 px-4 py-2">
        {/* Encabezado simple */}
        <div className="flex items-center justify-center mb-2 pb-1 border-b border-slate-300/50">
          <h3 className="text-xs font-bold text-slate-800">Resumen de Totales</h3>
        </div>

        {/* Valores en un único renglón */}
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-medium">Subtotal s/IVA:</span>
            <span className="text-slate-800 font-bold">${totales.subtotal?.toFixed(2) ?? "0.00"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-medium">Subtotal c/Desc:</span>
            <span className="text-slate-800 font-bold">${totales.subtotalConDescuentos?.toFixed(2) ?? "0.00"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-medium">IVA:</span>
            <span className="text-slate-800 font-bold">${totales.iva?.toFixed(2) ?? "0.00"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-medium">Total c/IVA:</span>
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-2 py-0.5 rounded-md shadow-sm">
              <span className="font-bold">${totales.total?.toFixed(2) ?? "0.00"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
