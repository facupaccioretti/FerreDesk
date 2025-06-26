// ATENCIÓN: Esta función es el ÚNICO punto de mapeo de ítems para el backend de ventas/presupuestos.
// SOLO se deben mapear y enviar los campos base requeridos por el modelo físico (no de la vista calculada).
// NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
// Si accidentalmente se agregan, serán eliminados antes de devolver el objeto.
// Revisar DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt para la lista de campos válidos.
// Si tienes dudas, consulta con el equipo antes de modificar esta función.

/**
 * Mapea los campos de un item para el formato del backend
 * @param {Object} item - Item a mapear
 * @param {number} idx - Índice del item
 * @param {boolean} esModificacion - Si es true, preserva todos los campos originales (para edición)
 * @returns {Object} Item mapeado SOLO con campos base
 */
export const mapearCamposItem = (item, idx, esModificacion = false) => {
  console.log('[mapearCamposItem] Recibiendo item para mapear:', JSON.parse(JSON.stringify(item)));

  let idaliiva = item.producto?.idaliiva ?? item.alicuotaIva ?? item.vdi_idaliiva ?? null;
  if (idaliiva && typeof idaliiva === 'object') {
    idaliiva = idaliiva.id;
  }
  const vdi_costo = item.costo ?? item.vdi_costo ?? (item.producto?.costo ?? 0);
  console.log('[mapearCamposItem] vdi_costo calculado:', vdi_costo);

  // Lista de campos permitidos. Se mantiene como referencia estática
  // aunque el mapeo se hace explícitamente más abajo.
  /* eslint-disable no-unused-vars */
  const CAMPOS_BASE = [
    'vdi_idve', 'vdi_orden', 'vdi_idsto', 'vdi_idpro', 'vdi_cantidad', 'vdi_costo', 'vdi_margen', 'vdi_bonifica', 'vdi_precio_unitario_final', 'vdi_detalle1', 'vdi_detalle2', 'vdi_idaliiva'
  ];
  /* eslint-enable no-unused-vars */
  // Mapear solo los campos base
  const camposMapeados = {
    vdi_idve: item.vdi_idve ?? null,
    vdi_orden: idx + 1,
    vdi_idsto: item.producto?.id ?? item.idSto ?? item.vdi_idsto ?? item.idsto ?? null,
    vdi_idpro: item.proveedorId ?? item.idPro ?? item.vdi_idpro ?? null,
    vdi_cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
    vdi_costo: vdi_costo,
    vdi_margen: item.margen ?? item.vdi_margen ?? (item.producto?.margen ?? 0),
    vdi_bonifica: item.bonificacion ?? item.bonifica ?? item.vdi_bonifica ?? 0,
    vdi_precio_unitario_final: item.precioFinal ?? item.vdi_precio_unitario_final ?? null,
    vdi_detalle1: item.denominacion ?? item.detalle1 ?? item.vdi_detalle1 ?? '',
    vdi_detalle2: item.detalle2 ?? item.vdi_detalle2 ?? '',
    vdi_idaliiva: idaliiva,
    // ATENCIÓN: No incluir campos como 'cuit' o 'domicilio' en los ítems. Estos solo corresponden a la cabecera de la venta.
    // Si necesitas esos datos, agrégalos en el objeto principal de la venta, nunca en los ítems.
  };

  console.log('[mapearCamposItem] Devolviendo item mapeado:', JSON.parse(JSON.stringify(camposMapeados)));

  // Eliminar cualquier campo calculado si accidentalmente se incluyó
  const camposCalculados = ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem', 'precioFinal'];
  camposCalculados.forEach(campo => { delete camposMapeados[campo]; });

  if (esModificacion) {
    // Preservar todos los campos originales, sobrescribiendo con los mapeados
    const resultado = {
      ...item, // Todos los campos originales (IDs, referencias, subtotales, etc.)
      ...camposMapeados // Sobrescribe solo los campos relevantes
    };
    // Defensa: eliminar campos calculados si accidentalmente se arrastran
    camposCalculados.forEach(campo => {
      if (resultado.hasOwnProperty(campo)) {
        delete resultado[campo];
      }
    });
    return resultado;
  } else {
    // Solo los campos mínimos requeridos
    return camposMapeados;
  }
};
// FIN DE LA FUNCIÓN mapearCamposItem
// Si necesitas agregar un campo nuevo, consulta primero la documentación y valida que sea un campo base físico, no calculado. 