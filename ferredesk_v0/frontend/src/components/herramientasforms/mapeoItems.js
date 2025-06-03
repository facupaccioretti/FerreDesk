/**
 * Mapea los campos de un item para el formato del backend
 * @param {Object} item - Item a mapear
 * @param {number} idx - Índice del item
 * @returns {Object} Item mapeado
 */
export const mapearCamposItem = (item, idx) => {
  let idaliiva = item.producto?.idaliiva ?? item.alicuotaIva ?? item.vdi_idaliiva ?? null;
  if (idaliiva && typeof idaliiva === 'object') {
    idaliiva = idaliiva.id;
  }
  return {
    vdi_orden: idx + 1,
    vdi_idsto: item.producto?.id ?? item.idSto ?? item.vdi_idsto ?? item.idsto ?? null,
    vdi_idpro: item.proveedorId ?? item.idPro ?? item.vdi_idpro ?? null,
    vdi_cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
    vdi_importe: item.precio ?? item.costo ?? item.importe ?? item.vdi_importe ?? 0,
    vdi_bonifica: item.bonificacion ?? item.bonifica ?? item.vdi_bonifica ?? 0,
    vdi_detalle1: item.denominacion ?? item.detalle1 ?? item.vdi_detalle1 ?? '',
    vdi_detalle2: item.detalle2 ?? item.vdi_detalle2 ?? '',
    vdi_idaliiva: idaliiva,
  };
}; 