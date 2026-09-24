// tipoItem.js — Módulo central: define el shape de un ítem de grilla
// y provee funciones fábricas para crearlo desde distintos orígenes.
//
// POR QUÉ: Antes de esta refactorización, la lógica de creación de ítems estaba
// duplicada en normalizadorItems.js, mapeoItems.js e ItemsGrid.js. Este módulo
// centraliza ese contrato para que cualquier cambio al shape se haga en un solo lugar.

import { obtenerPrecioParaLista, calcularPrecioLista } from '../../../utils/calcularPrecioLista'

// ──────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────

/**
 * Mapa de alícuotas IVA por defecto.
 * Se usa SOLO si el backend aún no proveyó datos de alícuotas.
 */
export const ALICUOTAS_POR_DEFECTO = {
    3: 0,
    4: 10.5,
    5: 21,
    6: 27,
}

// ──────────────────────────────────────────────────────────────────
// Shape canónico: JSDoc type para referencia del equipo
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ItemCanonicoShape
 * @property {number|string} id - Identificador único del ítem (puede ser temporal con Date.now + random)
 * @property {Object|null} producto - Objeto producto completo o stub. null para genéricos.
 * @property {string} codigo - Código de venta (codvta) o código de barras
 * @property {string} denominacion - Descripción principal del ítem (vdi_detalle1)
 * @property {string} unidad - Unidad de medida (vdi_detalle2)
 * @property {number} cantidad - Cantidad del ítem
 * @property {number|string} precio - Precio base sin IVA (campo derivado, NO se envía al backend)
 * @property {number|string} precioFinal - Precio unitario final con IVA (vdi_precio_unitario_final)
 * @property {number} bonificacion - Porcentaje de bonificación particular (vdi_bonifica)
 * @property {number} idaliiva - ID de alícuota IVA
 * @property {number|null} vdi_costo - Costo del producto
 * @property {number|null} margen - Margen de ganancia en porcentaje
 * @property {boolean} esBloqueado - Si el ítem es inmutable (ej: conversión factura interna → fiscal)
 * @property {boolean} noDescontarStock - Si no se debe descontar stock (ej: conversión factura interna)
 * @property {number|null} idOriginal - ID del ítem original en caso de conversión
 */

// ──────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────

/**
 * Genera un ID temporal único para ítems nuevos en el frontend.
 * @returns {number}
 */
export const generarIdTemporal = () => Date.now() + Math.random()

/**
 * Devuelve el valor solo si no es string vacío, null ni undefined.
 * POR QUÉ: Los campos del backend a veces vienen como '' en lugar de null,
 * y queremos que el fallback chain funcione correctamente.
 */
const valorNoVacio = (val) => {
    if (val === null || val === undefined) return undefined
    if (typeof val === 'string' && val.trim() === '') return undefined
    return val
}

/**
 * Extrae el ID numérico de una alícuota IVA que puede venir como objeto { id: N } o número.
 * POR QUÉ: El backend a veces devuelve el objeto completo de alícuota y otras veces solo el ID.
 */
export const extraerIdAlicuota = (idaliiva) => {
    if (idaliiva && typeof idaliiva === 'object') return idaliiva.id
    return Number(idaliiva) || 0
}

/**
 * Obtiene el porcentaje de IVA para un ID de alícuota dado.
 * @param {number} idaliiva - ID de alícuota
 * @param {Object} aliMap - Mapa {id: porcentaje} del backend
 * @returns {number} Porcentaje de IVA
 */
export const obtenerPorcentajeIVA = (idaliiva, aliMap = {}) => {
    return aliMap[idaliiva] ?? ALICUOTAS_POR_DEFECTO[idaliiva] ?? 0
}

const resolverCostoHabitualProducto = (producto) => {
    const proveedorHabitualId = producto?.proveedor_habitual?.id ?? producto?.proveedor_habitual_id ?? null
    const costoDesdeProveedorHabitual = producto?.stock_proveedores?.find(
        (sp) => sp?.proveedor?.id === proveedorHabitualId
    )?.costo

    return Number.parseFloat(
        costoDesdeProveedorHabitual ?? producto?.costo_habitual ?? producto?.costo ?? 0
    ) || 0
}

// ──────────────────────────────────────────────────────────────────
// Fábrica: Ítem vacío
// ──────────────────────────────────────────────────────────────────

/**
 * Crea un ítem vacío listo para ser renderizado en la última fila editable de la grilla.
 * Reemplaza la función `getEmptyRow()` que estaba duplicada en ItemsGrid y ItemsGridCompras.
 * @returns {ItemCanonicoShape}
 */
export function crearItemVacio() {
    return {
        id: generarIdTemporal(),
        codigo: '',
        denominacion: '',
        unidad: '',
        cantidad: 0,
        precio: '',
        precioFinal: '',
        bonificacion: 0,
        producto: null,
        idaliiva: 3, // ID 3 = 0% IVA por defecto
        vdi_costo: null,
        margen: null,
        esBloqueado: false,
        noDescontarStock: false,
        idOriginal: null,
        precioEditadoManualmente: false,
    }
}

// ──────────────────────────────────────────────────────────────────
// Fábrica: Stub de producto
// ──────────────────────────────────────────────────────────────────

/**
 * Crea un objeto producto "stub" a partir de los campos planos de un ítem del backend.
 * POR QUÉ: Cuando el backend devuelve un ítem de detalle de venta, no incluye
 * el objeto producto completo. Este stub permite que la grilla renderice el ítem
 * correctamente sin necesidad de hacer un fetch adicional.
 *
 * LIMITACIÓN CONOCIDA: El stub tiene `stock_proveedores: []` y `proveedor_habitual: null`.
 * Esto es correcto para mostrar precios históricos, pero causa un bug latente si el
 * usuario cambia la lista de precios (el recálculo cae al fallback con costo 0).
 * La guarda en useItemsGridState debe proteger contra esto.
 *
 * @param {Object} item - Ítem crudo del backend con campos vdi_*
 * @returns {Object} Objeto producto stub con los campos mínimos para la grilla
 */
export function crearStubProducto(item) {
    const idStock = Number(item.vdi_idsto || item.idSto || item.idsto || 0)
    const idaliiva = extraerIdAlicuota(item.vdi_idaliiva ?? item.idaliiva ?? 3)
    const margen = Number(item.vdi_margen ?? item.margen ?? 0)
    const costo = Number(item.vdi_costo ?? item.costo ?? 0)

    return {
        id: idStock,
        codvta: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? String(idStock || ''),
        codigo: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? String(idStock || ''),
        deno: item.denominacion ?? item.vdi_detalle1 ?? '',
        nombre: item.denominacion ?? item.vdi_detalle1 ?? '',
        unidad: item.unidad ?? item.vdi_detalle2 ?? '-',
        unidadmedida: item.unidad ?? item.vdi_detalle2 ?? '-',
        idaliiva,
        margen,
        costo,
        // LIMITACIÓN: Datos de proveedor vacíos. Ver docstring de la función.
        stock_proveedores: [],
        proveedor_habitual: null,
    }
}

// ──────────────────────────────────────────────────────────────────
// Fábrica: Ítem desde producto del catálogo (para carga nueva)
// ──────────────────────────────────────────────────────────────────

/**
 * Crea un ítem canónico a partir de un producto del catálogo (ej: al buscar por código o usar
 * el buscador de productos). Calcula el precio final según la lista de precios activa.
 *
 * POR QUÉ: Esta lógica estaba duplicada en 5 bloques dentro de ItemsGrid.js
 * (addItemWithDuplicado x2, handleRowKeyDown x2, handleCodigoBlur x1).
 *
 * @param {Object} producto - Producto completo del catálogo (con stock_proveedores, etc.)
 * @param {Object} opciones - Opciones de contexto
 * @param {Object} opciones.aliMap - Mapa de alícuotas {id: porcentaje}
 * @param {number} opciones.listaPrecioId - Número de lista de precios activa (0=Minorista)
 * @param {Array} opciones.listasPrecio - Configuración de listas de precios
 * @param {number} opciones.cantidad - Cantidad inicial (default: 1)
 * @returns {ItemCanonicoShape}
 */
export function crearItemDesdeProducto(producto, {
    aliMap = {},
    listaPrecioId = 0,
    listasPrecio = [],
    cantidad = 1,
} = {}) {
    const aliId = extraerIdAlicuota(producto.idaliiva ?? 3)
    const aliPorc = obtenerPorcentajeIVA(aliId, aliMap)

    // Buscar proveedor habitual para obtener costo
    const costoNum = resolverCostoHabitualProducto(producto)
    const margenNum = Number.parseFloat(producto?.margen ?? 0) || 0

    // Cálculo del precio final usando lista de precios activa con fallback a costo + margen + IVA
    let precioFinal = obtenerPrecioParaLista(producto, listaPrecioId, listasPrecio)
    if (!precioFinal) {
        // Calcular equivalente a Lista 0: costo + margen + IVA
        const neto = costoNum * (1 + margenNum / 100)
        const precioLista0 = neto * (1 + aliPorc / 100)

        // Aplicar recargo/descuento de la lista activa si no es Lista 0
        if (listaPrecioId > 0 && Array.isArray(listasPrecio)) {
            const listaConfig = listasPrecio.find(l => l.numero === listaPrecioId)
            const margenLista = Number(listaConfig?.margen_descuento || 0)
            precioFinal = calcularPrecioLista(precioLista0, margenLista)
        } else {
            precioFinal = precioLista0
        }
    }
    precioFinal = Math.round(precioFinal * 100) / 100

    // Precio base (sin IVA) derivado del precio final
    const divisorIva = 1 + aliPorc / 100
    const precioBase = divisorIva > 0
        ? Math.round((precioFinal / divisorIva) * 10000) / 10000
        : 0

    return {
        id: generarIdTemporal(),
        codigo: producto.codvta || producto.codigo || '',
        denominacion: producto.deno || producto.nombre || '',
        unidad: producto.unidad || producto.unidadmedida || '-',
        precio: precioBase,
        precioFinal,
        vdi_costo: costoNum,
        margen: margenNum,
        cantidad,
        bonificacion: 0,
        producto: producto,
        idaliiva: aliId,
        esBloqueado: false,
        noDescontarStock: false,
        idOriginal: null,
        precioEditadoManualmente: false,
    }
}

// ──────────────────────────────────────────────────────────────────
// Fábrica: Ítem desde datos crudos del backend (para normalización)
// ──────────────────────────────────────────────────────────────────

/**
 * Crea un ítem canónico a partir de datos crudos del backend (ej: al editar o convertir).
 * Resuelve la cascada de nombres (vdi_precio_unitario_final → precioFinal → etc).
 *
 * POR QUÉ: Esta lógica estaba en normalizadorItems.js Y en el useState initializer
 * de ItemsGrid.js, generando inconsistencias.
 *
 * @param {Object} item - Ítem crudo del backend con campos vdi_*
 * @param {Object} opciones - Opciones de normalización
 * @param {Object} opciones.aliMap - Mapa de alícuotas {id: porcentaje}
 * @param {boolean} opciones.esConversionFacturaI - Si es conversión factura interna → fiscal
 * @returns {ItemCanonicoShape}
 */
export function crearItemDesdeBackend(item, { aliMap = {}, esConversionFacturaI = false } = {}) {
    const itemId = item.id || generarIdTemporal()

    // Una linea de promocion nunca es generica ni de stock: es su propio tipo
    // de fila, resuelta aparte para no forzarla por las ramas de abajo.
    if (item.vdi_promocion || item.tipo === 'promocion') {
        return crearItemPromocionDesdeBackend(item, itemId)
    }

    // Determinar si el ítem es genérico (sin stock) o de stock
    const tieneIdStock = item.vdi_idsto || item.idSto || item.idsto
    const esGenerico = !tieneIdStock && !item.producto

    // Resolver alícuota IVA
    const idaliivaRaw = item.vdi_idaliiva ?? item.idaliiva ?? (item.producto?.idaliiva ?? 3)
    const idaliiva = extraerIdAlicuota(idaliivaRaw)
    const aliPorc = obtenerPorcentajeIVA(idaliiva, aliMap)

    // Metadatos de conversión
    const esBloqueado = esConversionFacturaI || (item.esBloqueado === true)
    const noDescontarStock = esConversionFacturaI || (item.noDescontarStock === true)
    const idOriginal = esConversionFacturaI ? itemId : (item.idOriginal ?? null)

    if (esGenerico) {
        const precioFinalBD = Number(item.vdi_precio_unitario_final ?? item.precioFinal ?? 0)
        return {
            id: itemId,
            producto: null,
            codigo: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? '',
            denominacion: valorNoVacio(item.denominacion) ?? item.vdi_detalle1 ?? '',
            unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? item.unidadmedida ?? '-',
            cantidad: Number(item.cantidad ?? item.vdi_cantidad ?? 1),
            precio: precioFinalBD,
            precioFinal: precioFinalBD,
            vdi_costo: (precioFinalBD && (1 + aliPorc / 100) > 0)
                ? precioFinalBD / (1 + aliPorc / 100)
                : 0,
            margen: 0,
            bonificacion: Number(item.vdi_bonifica ?? item.bonificacion ?? 0),
            idaliiva,
            esBloqueado,
            noDescontarStock,
            idOriginal,
            precioEditadoManualmente: item.precioEditadoManualmente ?? true,
        }
    }

    // Ítem de stock: resolver o crear stub de producto
    let producto = item.producto
    if ((!producto || !producto.id) && tieneIdStock) {
        producto = crearStubProducto(item)
    }

    // Margen con precedencia: vdi_margen > margen > producto.margen
    const margen = (() => {
        if (item.vdi_margen && Number(item.vdi_margen) !== 0) return Number(item.vdi_margen)
        if (item.margen && Number(item.margen) !== 0) return Number(item.margen)
        return Number(producto?.margen || 0)
    })()

    // Precio final histórico del backend
    const precioFinalBD = item.vdi_precio_unitario_final ?? item.precioFinal ?? null

    // Precio base (sin IVA) - derivar del precio final o calcular desde costo + margen
    let precioBase = (() => {
        // 1. Si ya viene explícitamente un precio base
        if (item.precio !== undefined && item.precio !== null && Number(item.precio) !== 0) {
            return Number(item.precio)
        }
        // 2. Si hay un precio final en la BD, calcular el base a partir de él
        if (precioFinalBD !== undefined && precioFinalBD !== null && Number(precioFinalBD) !== 0) {
            const divisorIva = 1 + aliPorc / 100
            return divisorIva > 0 ? Number(precioFinalBD) / divisorIva : 0
        }
        // 3. Último recurso: costo + margen
        const costoDelProducto = Number(item.vdi_costo ?? item.costo ?? producto?.costo ?? 0)
        return costoDelProducto * (1 + margen / 100)
    })()
    precioBase = Number.isFinite(precioBase) ? precioBase : 0

    // Precio final con IVA - usar BD si es consistente, sino recalcular
    let precioFinal = Number(precioFinalBD || 0)
    const precioFinalCalculado = precioBase * (1 + aliPorc / 100)
    if (!precioFinal || precioFinal === 0 || Math.abs(precioFinal.toFixed(2) - precioFinalCalculado.toFixed(2)) > 0.001) {
        precioFinal = precioFinalCalculado
    }
    precioFinal = Number(precioFinal.toFixed(2))

    return {
        id: itemId,
        producto,
        codigo: valorNoVacio(item.vdi_codigo) ?? valorNoVacio(item.codigo) ?? valorNoVacio(item.codvta) ?? producto?.codvta ?? producto?.codigo ?? '',
        denominacion: valorNoVacio(item.denominacion) ?? item.vdi_detalle1 ?? producto?.deno ?? producto?.nombre ?? '',
        unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? producto?.unidad ?? producto?.unidadmedida ?? '-',
        cantidad: Number(item.cantidad ?? item.vdi_cantidad ?? 1),
        precio: Number(precioBase.toFixed(4)),
        precioFinal,
        vdi_costo: producto
            ? Number(item.costo ?? item.vdi_costo ?? producto?.costo ?? 0)
            : Number(item.costo ?? item.vdi_costo ?? precioBase ?? 0),
        margen: Number(margen),
        bonificacion: Number(item.vdi_bonifica ?? item.bonificacion ?? 0),
        idaliiva,
        esBloqueado,
        noDescontarStock,
        idOriginal,
        precioEditadoManualmente: item.precioEditadoManualmente ?? true,
    }
}

// ──────────────────────────────────────────────────────────────────
// Fabrica: Item de promocion
// ──────────────────────────────────────────────────────────────────
//
// POR QUE: Una promocion no es un producto del catalogo, es su propia linea
// comercial ("tipo promocion"). No tiene precio/IVA/bonificacion editables
// por renglon (el precio es fijo, definido al crear la promo) y su "stock"
// real son varios componentes a la vez, no uno solo. Este tipo de fila se
// resuelve aparte de crearItemDesdeProducto/crearItemDesdeBackend para no
// forzar esa forma en las ramas pensadas para productos sueltos.

/**
 * Busca, dentro de las elecciones ya hechas por el usuario, la alternativa
 * elegida para un grupo puntual de una promocion.
 * @param {Object} grupo - Grupo de la promo (con .id y .alternativas)
 * @param {Array} eleccionesGrupos - [{ grupo_id, stock_id }, ...]
 * @returns {Object|null} La alternativa elegida, o null si el grupo no tiene eleccion todavia
 */
export function resolverAlternativaElegidaGrupo(grupo, eleccionesGrupos = []) {
    const eleccion = (eleccionesGrupos || []).find((e) => e.grupo_id === grupo.id)
    if (!eleccion) return null
    return (grupo.alternativas || []).find((a) => a.stock_id === eleccion.stock_id) || null
}

/**
 * Arma el texto de resumen de una promocion ("Vodka x1 · Redbull x2") a partir
 * de su definicion completa (componentes fijos + grupos) y las elecciones ya
 * hechas para los grupos. Se usa al armar o reconfigurar una fila, antes de
 * guardar el documento.
 * @param {Object} promocion - Promocion con .items (fijos) y .grupos (a eleccion)
 * @param {Array} eleccionesGrupos - [{ grupo_id, stock_id }, ...]
 * @returns {string}
 */
export function construirResumenPromocion(promocion, eleccionesGrupos = []) {
    const partesFijas = (promocion?.items || []).map(
        (it) => `${it.denominacion || it.codigo || 'Producto'} x${it.cantidad}`
    )
    const partesGrupos = (promocion?.grupos || []).map((grupo) => {
        const alternativa = resolverAlternativaElegidaGrupo(grupo, eleccionesGrupos)
        const nombre = alternativa ? (alternativa.denominacion || alternativa.codigo) : `${grupo.nombre} (sin elegir)`
        return `${nombre} x${grupo.cantidad}`
    })
    return [...partesFijas, ...partesGrupos].join(' · ')
}

/**
 * Arma el texto de resumen de una linea de promocion YA VENDIDA, a partir del
 * snapshot congelado que devuelve el backend (componentes_promocion). Se usa
 * al cargar un documento existente, sin depender de la Promocion actual (que
 * pudo haber cambiado desde que se vendio esta linea).
 * @param {Array} componentes - [{ denominacion, codigo, cantidad }, ...]
 * @returns {string}
 */
export function construirResumenDesdeComponentes(componentes = []) {
    return (componentes || [])
        .map((c) => `${c.denominacion || c.codigo || 'Producto'} x${c.cantidad}`)
        .join(' · ')
}

/**
 * Crea un item canonico de tipo "promocion" a partir de una Promocion elegida
 * en el selector (SelectorPromocionModal/ConfiguradorPromocionModal).
 *
 * @param {Object} promocion - Promocion completa (id, nombre, precio_promocional, items, grupos)
 * @param {Object} opciones
 * @param {Array} opciones.eleccionesGrupos - [{ grupo_id, stock_id }, ...] (una por cada grupo de la promo)
 * @param {number} opciones.cantidad - Cantidad inicial (default: 1)
 * @returns {ItemCanonicoShape}
 */
export function crearItemDesdePromocion(promocion, { eleccionesGrupos = [], cantidad = 1 } = {}) {
    return {
        id: generarIdTemporal(),
        tipo: 'promocion',
        producto: null,
        promocionId: promocion.id,
        promocion,
        promocionNombre: promocion.nombre,
        eleccionesGrupos,
        componentesPromocion: [],
        codigo: 'PROMO',
        denominacion: promocion.nombre,
        resumenComponentes: construirResumenPromocion(promocion, eleccionesGrupos),
        unidad: '-',
        cantidad,
        precio: '',
        precioFinal: Number(promocion.precio_promocional) || 0,
        bonificacion: 0,
        idaliiva: null,
        vdi_costo: null,
        margen: null,
        esBloqueado: false,
        noDescontarStock: false,
        idOriginal: null,
        precioEditadoManualmente: false,
    }
}

/**
 * Reconstruye, a partir del snapshot congelado de una linea ya vendida
 * (componentes_promocion, con stock_id) y la definicion ACTUAL de la
 * promocion (con sus grupos y alternativas), a que grupo pertenece cada
 * componente elegido. Se usa al abrir el configurador para "reconfigurar":
 * si la promocion no cambio, esto reconstruye exactamente lo que el
 * vendedor eligio; si un grupo cambio de alternativas y la elegida ya no
 * esta, ese grupo simplemente queda sin preseleccion (el usuario debe
 * volver a elegir), en linea con que un snapshot vendido nunca se asume
 * vigente contra la promocion actual.
 * @param {Object} promocion - Promocion completa y actual (con .grupos)
 * @param {Array} componentes - componentes_promocion de la linea vendida (con stock_id)
 * @returns {Array} [{ grupo_id, stock_id }, ...]
 */
export function resolverEleccionesDesdeComponentes(promocion, componentes = []) {
    const stockIdsVendidos = new Set((componentes || []).map((c) => c.stock_id))
    const elecciones = []
    for (const grupo of promocion?.grupos || []) {
        const alternativaVendida = (grupo.alternativas || []).find((a) => stockIdsVendidos.has(a.stock_id))
        if (alternativaVendida) {
            elecciones.push({ grupo_id: grupo.id, stock_id: alternativaVendida.stock_id })
        }
    }
    return elecciones
}

/**
 * Crea un item canonico de tipo "promocion" a partir de una linea ya
 * persistida en el backend (vdi_promocion + promocion_nombre + componentes_promocion).
 * Usa el snapshot congelado para el resumen, no la Promocion en vivo.
 * @param {Object} item - Item crudo del backend
 * @param {number|string} itemId - Id ya resuelto (backend o temporal)
 * @returns {ItemCanonicoShape}
 */
function crearItemPromocionDesdeBackend(item, itemId) {
    const componentes = Array.isArray(item.componentes_promocion) ? item.componentes_promocion : []
    const nombre = valorNoVacio(item.promocion_nombre) ?? valorNoVacio(item.vdi_detalle1) ?? ''
    return {
        id: itemId,
        tipo: 'promocion',
        producto: null,
        promocionId: item.vdi_promocion,
        promocion: null, // no viaja con la linea vendida; se resuelve al reconfigurar (fetch por id)
        promocionNombre: nombre,
        eleccionesGrupos: [],
        componentesPromocion: componentes,
        codigo: 'PROMO',
        denominacion: nombre,
        resumenComponentes: construirResumenDesdeComponentes(componentes),
        unidad: valorNoVacio(item.unidad) ?? item.vdi_detalle2 ?? '-',
        cantidad: Number(item.cantidad ?? item.vdi_cantidad ?? 1),
        precio: '',
        precioFinal: Number(item.vdi_precio_unitario_final ?? item.precioFinal ?? 0),
        bonificacion: 0,
        idaliiva: extraerIdAlicuota(item.vdi_idaliiva ?? item.idaliiva ?? 3),
        vdi_costo: Number(item.vdi_costo ?? item.costo ?? 0),
        margen: Number(item.vdi_margen ?? item.margen ?? 0),
        esBloqueado: item.esBloqueado === true,
        noDescontarStock: item.noDescontarStock === true,
        idOriginal: item.idOriginal ?? null,
        precioEditadoManualmente: false,
    }
}
