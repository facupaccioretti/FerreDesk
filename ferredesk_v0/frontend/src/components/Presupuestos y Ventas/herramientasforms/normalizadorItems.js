// Archivo central para normalización de ítems en formularios de venta, presupuesto, conversión y nota de crédito.
// No modificar sin revisar reglas de negocio y Documentacion/Normalizacion.md.

const ALICUOTAS_POR_DEFECTO = {
  3: 0,
  4: 10.5,
  5: 21,
  6: 27,
};

/**
 * Normaliza un array de ítems crudos según reglas de negocio.
 * @param {Array} itemsSeleccionados - Ítems provenientes de la vista o del estado.
 * @param {Object} opciones - Opciones de normalización.
 * @param {string} opciones.modo - 'venta'|'presupuesto'|'nota_credito'.
 * @param {Object} opciones.alicuotasMap - Mapa de alícuotas IVA (id: porcentaje) de la API.
 * @param {boolean} opciones.esConversionFacturaI - Si es conversión de factura interna, marca items como originales automáticamente.
 * @returns {Array} Lista de ítems normalizados preparados para la grilla.
 */
export function normalizarItems(itemsSeleccionados = [], { modo = 'venta', alicuotasMap = {}, esConversionFacturaI = false } = {}) {
  if (!Array.isArray(itemsSeleccionados)) return [];

  // Helper: devuelve el valor solo si no es string vacío ni null/undefined
  const valorNoVacio = (val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  };

  return itemsSeleccionados.map((item, idx) => {
    // Generación de ID más robusta para nuevos ítems en el frontend.
    // Si el ítem ya tiene un ID (ej. viene de la BD), se mantiene.
    const itemId = item.id || Date.now() + Math.random();

    // NUEVA LÓGICA: Determinar si es item de stock basándose en vdi_idsto, no en catálogo
    const tieneIdStock = item.vdi_idsto || item.idSto || item.idsto;
    const esGenerico = !tieneIdStock && !item.producto;

    if (esGenerico) {
      // Ítem genérico: no tiene ID de stock, se trata como producto libre
      const precioFinalBD = item.vdi_precio_unitario_final ?? item.precioFinal ?? null;
      const idaliiva = item.vdi_idaliiva ?? item.idaliiva ?? 3;
      const aliPorc = alicuotasMap[idaliiva] ?? ALICUOTAS_POR_DEFECTO[idaliiva] ?? 0;

      return {
        id: itemId,
        producto: null,
        codigo: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? '',
        denominacion: valorNoVacio(item.denominacion) ?? item.vdi_detalle1 ?? '',
        unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? item.unidadmedida ?? '-',
        cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
        // Para genéricos, el precio y precioFinal son el mismo valor que se edita.
        precio: Number(precioFinalBD || 0),
        precioFinal: Number(precioFinalBD || 0),
        // El costo de un genérico es su propio precio de venta sin IVA.
        vdi_costo: (precioFinalBD && (1 + aliPorc / 100) > 0) ? precioFinalBD / (1 + aliPorc / 100) : 0,
        margen: 0,
        bonificacion: Number(item.vdi_bonifica ?? item.bonificacion ?? 0),
        proveedorId: null,
        idaliiva,
        // Preservar metadatos de conversión si existen o marcar automáticamente para conversiones de factura interna
        esBloqueado: esConversionFacturaI || (item.esBloqueado !== undefined ? item.esBloqueado : false),
        noDescontarStock: esConversionFacturaI || (item.noDescontarStock !== undefined ? item.noDescontarStock : false),
        idOriginal: esConversionFacturaI ? itemId : (item.idOriginal !== undefined ? item.idOriginal : null),
      };
    }

    // Ítem de stock: tiene vdi_idsto o producto, crear producto stub si no existe
    let producto = item.producto;
    if ((!producto || !producto.id) && tieneIdStock) {
      // Crear producto stub con los datos disponibles del item
      producto = {
        id: Number(item.vdi_idsto || item.idSto || item.idsto || tieneIdStock),
        codvta: item.vdi_codigo ?? item.codigo ?? String(tieneIdStock),
        codigo: item.vdi_codigo ?? item.codigo ?? String(tieneIdStock),
        deno: item.denominacion ?? item.vdi_detalle1 ?? '',
        nombre: item.denominacion ?? item.vdi_detalle1 ?? '',
        unidad: item.unidad ?? item.vdi_detalle2 ?? '-',
        unidadmedida: item.unidad ?? item.vdi_detalle2 ?? '-',
        idaliiva: item.vdi_idaliiva ?? item.idaliiva ?? 3,
        margen: item.vdi_margen ?? item.margen ?? 0,
        costo: item.vdi_costo ?? item.costo ?? 0,
        stock_proveedores: [],
        proveedor_habitual: null,
      };
    }

    // Margen con precedencia: vdi_margen > margen > producto.margen
    let margen = 0;
    if (producto) {
      margen = item.vdi_margen && Number(item.vdi_margen) !== 0
        ? Number(item.vdi_margen)
        : item.margen && Number(item.margen) !== 0
          ? Number(item.margen)
          : Number(producto?.margen || 0);
    }

    // CORRECCIÓN: Priorizar IVA histórico del detalle de venta para mantener integridad fiscal
    const idaliivaRawTmp = item.vdi_idaliiva ?? item.idaliiva ?? producto?.idaliiva ?? null;
    const idAliVal = (idaliivaRawTmp && typeof idaliivaRawTmp === 'object') ? idaliivaRawTmp.id : idaliivaRawTmp;
    const idaliiva = Number(idAliVal) || 0;
    const aliPorc = alicuotasMap[idaliiva] ?? ALICUOTAS_POR_DEFECTO[idaliiva] ?? 0;

    // Lógica robusta para determinar precioBase (sin IVA) y precioFinal (con IVA)
    const precioFinalBD = item.vdi_precio_unitario_final ?? item.precioFinal ?? null;

    let precioBase = (() => {
      // 1. Si el precio base ya viene explícitamente en el ítem (del formulario), usarlo.
      if (item.precio !== undefined && item.precio !== null && Number(item.precio) !== 0) {
        return Number(item.precio);
      }
      // 2. Si hay un precio final en la BD, calcular el base a partir de él.
      if (precioFinalBD !== undefined && precioFinalBD !== null && Number(precioFinalBD) !== 0) {
        const divisorIva = 1 + aliPorc / 100;
        return divisorIva > 0 ? Number(precioFinalBD) / divisorIva : 0;
      }
      // 3. Si no hay precio final, intentar con un precio directo (que puede ser costo o vdi_importe).
      const precioDirecto = item.vdi_importe ?? item.costo ?? 0;
      if (precioDirecto !== undefined && precioDirecto !== null && Number(precioDirecto) !== 0) {
        return Number(precioDirecto);
      }
      // 4. Como último recurso, calcularlo desde el costo del producto + margen.
      const costoDelProducto = item.vdi_costo ?? item.costo ?? Number(producto?.costo || 0);
      return costoDelProducto * (1 + margen / 100);
    })();

    // Asegurar que precioBase sea un número válido
    precioBase = Number.isFinite(precioBase) ? precioBase : 0;

    // Precio final (con IVA) - Recalcular si no vino en BD o si el precio base cambió significativamente.
    let precioFinal = Number(precioFinalBD || 0);
    const precioFinalCalculado = precioBase * (1 + aliPorc / 100);
    // Revaluar si el precioFinal existente es consistente con el precioBase y alícuota actual.
    if (!precioFinal || Number(precioFinal) === 0 || Math.abs(precioFinal.toFixed(2) - precioFinalCalculado.toFixed(2)) > 0.001) {
      precioFinal = precioFinalCalculado;
    }
    precioFinal = Number(precioFinal.toFixed(2));

    return {
      id: itemId,
      producto: producto,
      // CORRECCIÓN: Mejorar mapeo de código para items originales
      // Priorizar variantes del código en el ítem (incluido vdi_codigo) y luego el del producto
      codigo: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? valorNoVacio(item.codvta) ?? producto?.codvta ?? producto?.codigo ?? '',
      denominacion: valorNoVacio(item.denominacion) ?? item.vdi_detalle1 ?? producto?.deno ?? producto?.nombre ?? '',
      unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? producto?.unidad ?? producto?.unidadmedida ?? '-',
      cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
      precio: Number(precioBase.toFixed(4)),
      precioFinal: precioFinal,
      // El vdi_costo para ítems genéricos es el precioBase (precio de venta sin IVA).
      vdi_costo: producto
        ? Number(item.costo ?? item.vdi_costo ?? producto?.costo ?? 0)
        : Number(item.costo ?? item.vdi_costo ?? precioBase ?? 0),
      margen: Number(margen),
      bonificacion: Number(item.vdi_bonifica ?? item.bonificacion ?? 0),
      proveedorId: item.vdi_idpro ?? item.proveedorId ?? null,
      idaliiva,
      // Preservar metadatos de conversión si existen o marcar automáticamente para conversiones de factura interna
      esBloqueado: esConversionFacturaI || (item.esBloqueado !== undefined ? item.esBloqueado : false),
      noDescontarStock: esConversionFacturaI || (item.noDescontarStock !== undefined ? item.noDescontarStock : false),
      idOriginal: esConversionFacturaI ? itemId : (item.idOriginal !== undefined ? item.idOriginal : null),
    };
  });
}

// Se elimina el export default para mantener un solo tipo de exportación y compatibilidad futura. 