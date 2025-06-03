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
    const precio = parseFloat(item.precio ?? item.costo ?? item.vdi_importe) || 0;
    return cantidad * precio;
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