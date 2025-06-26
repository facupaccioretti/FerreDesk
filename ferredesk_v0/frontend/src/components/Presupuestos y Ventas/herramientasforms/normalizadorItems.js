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
 * @param {Array} opciones.productos - Catálogo de productos disponibles.
 * @param {string} opciones.modo - 'venta'|'presupuesto'|'nota_credito'.
 * @param {Object} opciones.alicuotasMap - Mapa de alícuotas IVA (id: porcentaje) de la API.
 * @returns {Array} Lista de ítems normalizados preparados para la grilla.
 */
export function normalizarItems(itemsSeleccionados = [], { productos = [], modo = 'venta', alicuotasMap = {} } = {}) {
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

    // Reconstruir producto si es necesario
    const prod = item.producto || productos.find(p => String(p.id) === String(item.vdi_idsto || item.idSto || item.idsto || item.id));

    // Margen con precedencia: vdi_margen > margen > producto.margen
    // Para ítems genéricos, el margen es siempre 0.
    let margen = 0;
    if (prod) { // Si es un producto de stock (no genérico)
      margen = item.vdi_margen && Number(item.vdi_margen) !== 0
        ? Number(item.vdi_margen)
        : item.margen && Number(item.margen) !== 0
          ? Number(item.margen)
          : Number(prod?.margen || 0);
    } // Si no es un producto de stock, margen ya es 0 por defecto.

    // Alícuota id y porcentaje (prioriza alicuotasMap de la API, fallback a ALICUOTAS_POR_DEFECTO)
    const idaliivaRawTmp = item.idaliiva ?? prod?.idaliiva ?? item.vdi_idaliiva ?? null;
    const idAliVal = (idaliivaRawTmp && typeof idaliivaRawTmp === 'object') ? idaliivaRawTmp.id : idaliivaRawTmp;
    const idaliiva = Number(idAliVal) || 0;
    const aliPorc = alicuotasMap[idaliiva] ?? ALICUOTAS_POR_DEFECTO[idaliiva] ?? 0;

    // Lógica robusta para determinar precioBase (sin IVA) y precioFinal (con IVA)
    const precioFinalBD = item.vdi_precio_unitario_final ?? item.precioFinal ?? null; // Precio final si viene de la base de datos

    // Para ítems genéricos, el precio de entrada es el final. No se calcula base.
    const esGenerico = !prod;
    if (esGenerico) {
        return {
            id: itemId,
            producto: null,
            codigo: valorNoVacio(item.vdi_detalle1) ? '-' : '',
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
        };
    }

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
      const costoDelProducto = item.vdi_costo ?? item.costo ?? Number(prod?.costo || 0);
      return costoDelProducto * (1 + margen / 100);
    })();

    // Asegurar que precioBase sea un número válido
    precioBase = Number.isFinite(precioBase) ? precioBase : 0;

    // Precio final (con IVA) - Recalcular si no vino en BD o si el precio base cambió significativamente.
    let precioFinal = Number(precioFinalBD || 0); // Asegurar que precioFinal es un número desde el inicio
    const precioFinalCalculado = precioBase * (1 + aliPorc / 100);
    // Revaluar si el precioFinal existente es consistente con el precioBase y alícuota actual.
    if (!precioFinal || Number(precioFinal) === 0 || Math.abs(precioFinal.toFixed(2) - precioFinalCalculado.toFixed(2)) > 0.001) {
        precioFinal = precioFinalCalculado;
    }
    precioFinal = Number(precioFinal.toFixed(2)); // Asegurar 2 decimales para el precio final

    return {
      id: itemId,
      producto: prod,
      codigo: prod
        ? valorNoVacio(item.codigo) ?? prod?.codvta ?? prod?.codigo ?? ''
        : (valorNoVacio(item.vdi_detalle1) ? '-' : ''),
      denominacion: valorNoVacio(item.denominacion) ?? item.vdi_detalle1 ?? prod?.deno ?? prod?.nombre ?? '',
      unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? prod?.unidad ?? prod?.unidadmedida ?? '-',
      cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
      precio: Number(precioBase.toFixed(4)), // Redondeo a 4 decimales para precio sin IVA (interno)
      precioFinal: precioFinal, // Ya está redondeado a 2 decimales para el precio con IVA (mostrar)
      // El vdi_costo para ítems genéricos es el precioBase (precio de venta sin IVA).
      vdi_costo: prod
        ? Number(item.costo ?? item.vdi_costo ?? prod?.costo ?? 0) // Si es producto de stock, toma costo de item o producto
        : Number(item.costo ?? item.vdi_costo ?? precioBase ?? 0), // Si es genérico, toma precioBase como costo
      margen: Number(margen),
      bonificacion: Number(item.vdi_bonifica ?? item.bonificacion ?? 0),
      proveedorId: item.vdi_idpro ?? item.proveedorId ?? null,
      idaliiva,
    };
  });
}

// Se elimina el export default para mantener un solo tipo de exportación y compatibilidad futura. 