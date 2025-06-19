import { useMemo } from 'react';

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
  // Cálculo de subtotal base
  const calcularSubtotal = (item) => {
    const cantidad = parseFloat(item.cantidad ?? item.vdi_cantidad) || 0;
    const aliId = obtenerAliId(item);
    const aliPorc = alicuotas[aliId] || 0;
    const precioBase = parseFloat(item.precio ?? item.costo ?? item.vdi_importe) || 0;
    return cantidad * precioBase;
  };

  // Cálculo de bonificación particular
  const obtenerBonifParticular = (item) => {
    const bonif =
      item.bonificacion !== undefined ? parseFloat(item.bonificacion) :
      item.vdi_bonifica !== undefined ? parseFloat(item.vdi_bonifica) :
      0;
    return (!isNaN(bonif) && bonif > 0) ? bonif : null;
  };

  // Cálculo de bonificación
  const calcularBonificacion = (item) => {
    const subtotal = calcularSubtotal(item);
    const bonifParticular = obtenerBonifParticular(item);
    const bonif = bonifParticular !== null ? bonifParticular : (parseFloat(bonificacionGeneral) || 0);
    return subtotal * (bonif / 100);
  };

  // Subtotal neto tras bonificación
  const calcularSubtotalNeto = (item) => {
    const subtotal = calcularSubtotal(item);
    const bonificacion = calcularBonificacion(item);
    return subtotal - bonificacion;
  };

  // Cálculo de descuentos escalonados sobre el subtotal neto
  const calcularDescuento = (item) => {
    let precioConDescuento = calcularSubtotalNeto(item);
    if (descu1 > 0) precioConDescuento *= (1 - descu1 / 100);
    if (descu2 > 0) precioConDescuento *= (1 - descu2 / 100);
    if (descu3 > 0) precioConDescuento *= (1 - descu3 / 100);
    return calcularSubtotalNeto(item) - precioConDescuento;
  };

  // Cálculo de alícuota de IVA robusto
  const obtenerAliId = (item) => {
    return (
      item.alicuotaIva ??
      item.vdi_idaliiva ??
      item.idaliiva ??
      (item.producto && (item.producto.idaliiva?.id ?? item.producto.idaliiva)) ??
      0
    );
  };

  // Cálculo de IVA
  const calcularIVA = (item, subtotalSinIva, subtotalConDescuentos) => {
    const aliId = obtenerAliId(item);
    const aliPorc = alicuotas[aliId] || 0;
    const lineaSubtotal = calcularSubtotal(item);
    // Proporción del neto tras bonificación y descuentos
    const subtotalNeto = calcularSubtotalNeto(item);
    let precioConDescuento = subtotalNeto;
    if (descu1 > 0) precioConDescuento *= (1 - descu1 / 100);
    if (descu2 > 0) precioConDescuento *= (1 - descu2 / 100);
    if (descu3 > 0) precioConDescuento *= (1 - descu3 / 100);
    const proporcion = (lineaSubtotal) / (subtotalSinIva || 1);
    const itemSubtotalConDescuentos = subtotalConDescuentos * proporcion;
    // Alternativamente, usar el neto real de la línea:
    // const itemSubtotalConDescuentos = precioConDescuento;
    return itemSubtotalConDescuentos * (aliPorc / 100);
  };

  // Cálculo de total por línea
  const calcularTotal = (item, subtotalSinIva, subtotalConDescuentos) => {
    const subtotal = calcularSubtotal(item);
    const bonificacion = calcularBonificacion(item);
    const subtotalNeto = subtotal - bonificacion;
    let precioConDescuento = subtotalNeto;
    if (descu1 > 0) precioConDescuento *= (1 - descu1 / 100);
    if (descu2 > 0) precioConDescuento *= (1 - descu2 / 100);
    if (descu3 > 0) precioConDescuento *= (1 - descu3 / 100);
    const iva = calcularIVA(item, subtotalSinIva, subtotalConDescuentos);
    return precioConDescuento + iva;
  };

  // Cálculo de totales generales
  const calcularTotalesGenerales = () => {
    const subtotalSinIva = items.reduce((sum, item) => sum + calcularSubtotal(item), 0);
    // Sumar netos tras bonificación
    const subtotalNeto = items.reduce((sum, item) => sum + calcularSubtotalNeto(item), 0);
    // Sumar descuentos sobre netos
    let subtotalConDescuentos = items.reduce((sum, item) => {
      let precioConDescuento = calcularSubtotalNeto(item);
      if (descu1 > 0) precioConDescuento *= (1 - descu1 / 100);
      if (descu2 > 0) precioConDescuento *= (1 - descu2 / 100);
      if (descu3 > 0) precioConDescuento *= (1 - descu3 / 100);
      return sum + precioConDescuento;
    }, 0);
    const ivaTotal = items.reduce((sum, item) => sum + calcularIVA(item, subtotalSinIva, subtotalConDescuentos), 0);
    const total = subtotalConDescuentos + ivaTotal;
    return {
      subtotal: subtotalSinIva,
      subtotalNeto,
      subtotalConDescuentos,
      iva: ivaTotal,
      total
    };
  };

  // Memoizar cálculos
  const totales = useMemo(() => calcularTotalesGenerales(), [items, bonificacionGeneral, descu1, descu2, descu3, alicuotas]);

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
    <div className="mt-6 flex w-full justify-center">
      <div className="w-full max-w-3xl bg-gradient-to-r from-slate-50 via-slate-100/80 to-slate-50 rounded-lg shadow-md border border-slate-300/50 px-6 py-3">
        {/* Título compacto */}
        <div className="flex items-center justify-center gap-2 mb-3 pb-2 border-b border-slate-300/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 text-slate-700"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 15.75V18a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 2.25 18v-9A2.25 2.25 0 0 1 4.5 6.75h9a2.25 2.25 0 0 1 2.25 2.25V12M11.25 18h9l-3-3m0 0 3-3m-3 3H8.25"
            />
          </svg>
          <h3 className="text-sm font-bold text-slate-800">Resumen de Totales</h3>
        </div>

        {/* Layout horizontal compacto */}
        <div className="space-y-2">
          {/* Primera fila - Subtotal y descuentos */}
          <div className="flex items-center justify-between gap-6 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">Subtotal s/IVA:</span>
              <span className="text-slate-800 font-bold text-base">${totales.subtotal?.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">Bonif. General:</span>
              <span className="text-slate-700 font-bold text-base">{bonificacionGeneral}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">Descuento 1:</span>
              <span className="text-slate-700 font-bold text-base">{descu1}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">Descuento 2:</span>
              <span className="text-slate-700 font-bold text-base">{descu2}%</span>
            </div>
            {descu3 > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-slate-600 font-medium">Descuento 3:</span>
                <span className="text-slate-700 font-bold text-base">{descu3}%</span>
              </div>
            )}
          </div>

          {/* Segunda fila - Totales finales */}
          <div className="flex items-center justify-between gap-6 text-xs pt-2 border-t border-slate-300/50">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">Subtotal c/Descuentos:</span>
              <span className="text-slate-800 font-bold text-base">${totales.subtotalConDescuentos?.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 font-medium">IVA:</span>
              <span className="text-slate-800 font-bold text-base">${totales.iva?.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Total c/IVA:</span>
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-3 py-1 rounded-md shadow-sm">
                <span className="font-bold text-lg">${totales.total?.toFixed(2) ?? "0.00"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
