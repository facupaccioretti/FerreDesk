// Archivo central para normalización de ítems en formularios de venta, presupuesto, conversión y nota de crédito.
// Delega la creación de ítems a tipoItem.js para evitar duplicación de lógica.
// No modificar sin revisar reglas de negocio y Documentacion/Normalizacion.md.

import { crearItemDesdeBackend } from './tipoItem'

/**
 * Normaliza un array de ítems crudos según reglas de negocio.
 * POR QUÉ: Esta función es la ÚNICA puerta de entrada para transformar ítems crudos
 * (del backend, borradores o conversiones) al shape canónico que la grilla espera.
 *
 * @param {Array} itemsSeleccionados - Ítems provenientes de la vista o del estado.
 * @param {Object} opciones - Opciones de normalización.
 * @param {string} opciones.modo - 'venta'|'presupuesto'|'nota_credito'.
 * @param {Object} opciones.alicuotasMap - Mapa de alícuotas IVA (id: porcentaje) de la API.
 * @param {boolean} opciones.esConversionFacturaI - Si es conversión de factura interna, marca items como originales automáticamente.
 * @returns {Array} Lista de ítems normalizados preparados para la grilla.
 */
export function normalizarItems(itemsSeleccionados = [], { modo = 'venta', alicuotasMap = {}, esConversionFacturaI = false } = {}) {
  if (!Array.isArray(itemsSeleccionados)) return [];

  return itemsSeleccionados.map((item) =>
    crearItemDesdeBackend(item, { aliMap: alicuotasMap, esConversionFacturaI })
  );
}

// Se elimina el export default para mantener un solo tipo de exportación y compatibilidad futura. 