// useItemsGridState.js — Hook centralizado para el estado y lógica de la grilla de ítems.
//
// POR QUÉ: ItemsGrid.js acumulaba ~1200 líneas de lógica (búsqueda, duplicados, precios,
// cálculos, focus) mezclada con el renderizado. Este hook encapsula toda esa lógica
// para que ItemsGrid sea un componente de presentación puro.

import { useState, useRef, useEffect, useCallback } from 'react'
import { obtenerPrecioParaLista, calcularPrecioLista } from '../../../utils/calcularPrecioLista'
import { useProductoLookupRapido } from '../../../hooks/useProductoLookupRapido'
import {
    crearItemVacio,
    crearItemDesdeProducto,
    crearItemDesdeBackend,
    extraerIdAlicuota,
    obtenerPorcentajeIVA,
    generarIdTemporal,
    ALICUOTAS_POR_DEFECTO,
} from '../herramientasforms/tipoItem'

function resolverCostoHabitualProducto(producto) {
    const proveedorHabitualId = producto?.proveedor_habitual?.id ?? producto?.proveedor_habitual_id ?? null
    const costoDesdeProveedorHabitual = producto?.stock_proveedores?.find(
        (sp) => sp?.proveedor?.id === proveedorHabitualId
    )?.costo

    return Number.parseFloat(
        costoDesdeProveedorHabitual ?? producto?.costo_habitual ?? producto?.costo ?? 0
    ) || 0
}

// ──────────────────────────────────────────────────────────────────
// Hook principal
// ──────────────────────────────────────────────────────────────────

/**
 * @param {Object} props - Las mismas props que recibe ItemsGrid
 * @returns {Object} Estado y handlers para la grilla de ítems
 */
export function useItemsGridState({
    initialItems,
    autoSumarDuplicados,
    modo = 'presupuesto',
    readOnly = false,
    listaPrecioId = 0,
    listasPrecio = [],
    alicuotas = {},
    onRowsChange,
}) {

    // Combinar alícuotas del backend con un fallback seguro
    const aliMap = Object.keys(alicuotas || {}).length ? alicuotas : ALICUOTAS_POR_DEFECTO
    const { lookupProducto, obtenerDesdeCache } = useProductoLookupRapido({
        listaPrecioId,
        modo,
    })

    // ──────────────────────────────────────────────────────────────
    // Refs
    // ──────────────────────────────────────────────────────────────
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const bonificacionRefs = useRef([])
    const didAutoFocusRef = useRef(false)
    const procesandoCodigoRef = useRef(false)
    const ultimoEventoCodigoRef = useRef({
        rowId: null,
        codigo: null,
        origen: null,
        timestamp: 0,
    })
    const observabilidadLookupRef = useRef({
        secuencias: {},
        ultimoId: 0,
    })

    // ──────────────────────────────────────────────────────────────
    // Estado de foco
    // ──────────────────────────────────────────────────────────────
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)
    const [modoLector, setModoLector] = useState(false)
    const [idxCodigoSiguienteFoco, setIdxCodigoSiguienteFoco] = useState(null)
    const [stockNegativo, setStockNegativo] = useState(false)

    // Estado de tooltips (UI pero necesario para handlers)
    const [mostrarTooltipBonif, setMostrarTooltipBonif] = useState(false)
    const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false)
    const [mostrarTooltipOriginal, setMostrarTooltipOriginal] = useState({})
    const [posicionTooltip, setPosicionTooltip] = useState({ x: 0, y: 0 })

    // ──────────────────────────────────────────────────────────────
    // Helpers de precio
    // ──────────────────────────────────────────────────────────────

    // Helper: obtiene precio final (con IVA) según lista de precios activa.
    // Usa la utilidad importada con fallback al cálculo legacy (costo + margen + IVA).
    const obtenerPrecioBaseProducto = useCallback((producto) => {
        let precioBase = obtenerPrecioParaLista(producto, listaPrecioId, listasPrecio)

        const aliId = extraerIdAlicuota(producto.idaliiva ?? 3)
        const aliPorc = obtenerPorcentajeIVA(aliId, aliMap)

        // Fallback: si obtenerPrecioParaLista no encontró precio (stub sin precio_lista_0),
        // calcular equivalente a Lista 0 y aplicar el recargo/descuento de la lista activa.
        // POR QUÉ: Los stubs de edición no tienen stock_proveedores pero sí tienen
        // producto.costo (extraído de vdi_costo). Se usa como fallback final.
        if (!precioBase) {
            const costoNum = resolverCostoHabitualProducto(producto)
            const margenNum = Number.parseFloat(producto?.margen ?? 0) || 0
            const neto = costoNum * (1 + margenNum / 100)
            const precioLista0 = neto * (1 + aliPorc / 100)

            if (listaPrecioId > 0 && Array.isArray(listasPrecio)) {
                const listaConfig = listasPrecio.find(l => l.numero === listaPrecioId)
                const margenLista = Number(listaConfig?.margen_descuento || 0)
                precioBase = calcularPrecioLista(precioLista0, margenLista)
            } else {
                precioBase = precioLista0
            }
        }

        return Math.round(precioBase * 100) / 100
    }, [listaPrecioId, listasPrecio, aliMap])

    // ──────────────────────────────────────────────────────────────
    // Búsqueda remota por código
    // ──────────────────────────────────────────────────────────────

    const registrarObservabilidadLookup = useCallback((payload) => {
        if (typeof window === 'undefined') return

        window.__ferredesk_pos_baseline__ = window.__ferredesk_pos_baseline__ || {}
        window.__ferredesk_pos_baseline__.lookups = window.__ferredesk_pos_baseline__.lookups || []

        const registro = {
            componente: 'useItemsGridState',
            tenant_host: window.location.host,
            timestamp: new Date().toISOString(),
            ...payload,
        }

        window.__ferredesk_pos_baseline__.lookups.push(registro)
        window.__ferredesk_pos_baseline__.ultimoLookup = registro

        if (window.__ferredesk_pos_baseline__.lookups.length > 100) {
            window.__ferredesk_pos_baseline__.lookups = window.__ferredesk_pos_baseline__.lookups.slice(-100)
        }

        console.info('[POS_BASELINE_LOOKUP]', registro)
    }, [])

    const registrarEventoCodigo = useCallback((payload) => {
        ultimoEventoCodigoRef.current = {
            rowId: payload.rowId ?? null,
            codigo: String(payload.codigo || '').trim().toLowerCase(),
            origen: payload.origen ?? null,
            timestamp: Date.now(),
        }
    }, [])

    const debeSuprimirBlurCodigo = useCallback((rowId, codigo) => {
        const ultimoEvento = ultimoEventoCodigoRef.current
        if (ultimoEvento.origen !== 'keydown') {
            return false
        }

        const codigoNormalizado = String(codigo || '').trim().toLowerCase()
        return (
            ultimoEvento.rowId === rowId &&
            ultimoEvento.codigo === codigoNormalizado &&
            (Date.now() - ultimoEvento.timestamp) <= 700
        )
    }, [])

    // Búsqueda unificada: param "codigo" hace que el backend busque por codvta O código de barras.
    const buscarProductoPorCodigo = useCallback(async (codigo, contexto = {}) => {
        if (readOnly) return null

        const codigoTrim = (codigo || '').toString().trim()
        if (!codigoTrim) return null

        const rowId = contexto.rowId ?? `idx-${contexto.idx ?? 'na'}`
        const ahora = Date.now()
        const claveSecuencia = `${rowId}:${codigoTrim.toLowerCase()}`
        const secuenciaPrevia = observabilidadLookupRef.current.secuencias[claveSecuencia]
        const mismaSecuencia = secuenciaPrevia && (ahora - secuenciaPrevia.ultimoIntentoMs) <= 2500
        const secuencia = mismaSecuencia
            ? {
                ...secuenciaPrevia,
                requestCount: secuenciaPrevia.requestCount + 1,
                ultimoIntentoMs: ahora,
                origenes: Array.from(new Set([...(secuenciaPrevia.origenes || []), contexto.origen].filter(Boolean))),
            }
            : {
                id: ++observabilidadLookupRef.current.ultimoId,
                requestCount: 1,
                ultimoIntentoMs: ahora,
                origenes: contexto.origen ? [contexto.origen] : [],
            }
        observabilidadLookupRef.current.secuencias[claveSecuencia] = secuencia
        const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now()

        try {
            const productoCacheado = obtenerDesdeCache(codigoTrim)
            const producto = await lookupProducto(codigoTrim)
            if (!producto) {
                registrarObservabilidadLookup({
                    codigo: codigoTrim,
                    origen: contexto.origen || 'desconocido',
                    row_id: rowId,
                    secuencia_id: secuencia.id,
                    request_en_secuencia: secuencia.requestCount,
                    repeticion: secuencia.requestCount > 1,
                    origenes_detectados: secuencia.origenes,
                    cantidad_resultados: 0,
                    cache_hit: !!productoCacheado,
                    resultado: 'sin_resultados',
                    duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
                })
                return null
            }
            const esExacta =
                (producto?.codvta || producto?.codigo || '').toString().toLowerCase() === codigoTrim.toLowerCase() ||
                (producto?.codigo_barras || '').toString().toLowerCase() === codigoTrim.toLowerCase()
            registrarObservabilidadLookup({
                codigo: codigoTrim,
                origen: contexto.origen || 'desconocido',
                row_id: rowId,
                secuencia_id: secuencia.id,
                request_en_secuencia: secuencia.requestCount,
                repeticion: secuencia.requestCount > 1,
                origenes_detectados: secuencia.origenes,
                cantidad_resultados: 1,
                cache_hit: !!productoCacheado,
                producto_id: producto?.id ?? null,
                resultado: esExacta ? 'coincidencia_exacta' : 'coincidencia_no_exacta',
                duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
            })
            return producto
        } catch (error) {
            registrarObservabilidadLookup({
                codigo: codigoTrim,
                origen: contexto.origen || 'desconocido',
                row_id: rowId,
                secuencia_id: secuencia.id,
                request_en_secuencia: secuencia.requestCount,
                repeticion: secuencia.requestCount > 1,
                origenes_detectados: secuencia.origenes,
                resultado: 'error_lookup',
                error: error?.message || 'error_desconocido',
                duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
            })
            return null
        }
    }, [lookupProducto, obtenerDesdeCache, readOnly, registrarObservabilidadLookup])

    const restaurarCodigoSiLaFilaTieneProducto = useCallback((idx) => {
        setRows((prev) => {
            const nuevos = [...prev]
            const actual = nuevos[idx]
            if (actual && actual.producto) {
                const codigoOriginal = actual.producto.codvta || actual.producto.codigo || String(actual.producto.id || '')
                nuevos[idx] = { ...actual, codigo: codigoOriginal }
            }
            return nuevos
        })
    }, [])

    const aplicarProductoResueltoEnFila = (idx, row, prod, opciones = {}) => {
        const moverFoco = opciones.moverFoco !== false

        const idxExistente = rows.findIndex(
            (r, i) => i !== idx && r.producto && r.producto.id === prod.id && !r.esBloqueado && !r.idOriginal,
        )

        if (idxExistente !== -1) {
            if (autoSumarDuplicados === 'sumar') {
                setRows((rowsActuales) => {
                    const cantidadASumar = Number(row.cantidad) > 0 ? Number(row.cantidad) : 1
                    const newRows = rowsActuales.map((r, i) =>
                        i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + cantidadASumar } : r,
                    )
                    newRows[idx] = crearItemVacio()
                    return ensureSoloUnEditable(newRows)
                })
                if (moverFoco) {
                    if (modoLector) {
                        setIdxCodigoSiguienteFoco(idxExistente)
                    } else {
                        setIdxCantidadFoco(idxExistente)
                    }
                }
                return true
            }

            if (autoSumarDuplicados === 'duplicar') {
                setRows((prevRows) => {
                    const newRows = [...prevRows]
                    const itemCargado = {
                        ...crearItemDesdeProducto(prod, { aliMap, listaPrecioId, listasPrecio, cantidad: row.cantidad || 1 }),
                        id: newRows[idx].id,
                    }
                    newRows[idx] = itemCargado
                    if (newRows.every(isRowLleno) && !readOnly) {
                        newRows.push(crearItemVacio())
                    }
                    return ensureSoloUnEditable(newRows)
                })
                if (moverFoco) {
                    if (modoLector) {
                        setIdxCodigoSiguienteFoco(idx)
                    } else {
                        setIdxCantidadFoco(idx)
                    }
                }
                return true
            }

            return true
        }

        setRows((prevRows) => {
            const newRows = [...prevRows]
            const itemCargado = {
                ...crearItemDesdeProducto(prod, { aliMap, listaPrecioId, listasPrecio, cantidad: row.cantidad || 1 }),
                id: newRows[idx].id,
            }
            newRows[idx] = itemCargado
            if (newRows.every(isRowLleno) && !readOnly) {
                newRows.push(crearItemVacio())
            }
            return ensureSoloUnEditable(newRows)
        })

        if (moverFoco) {
            if (modoLector) {
                setIdxCodigoSiguienteFoco(idx)
            } else {
                setIdxCantidadFoco(idx)
            }
        }

        return true
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers de fila
    // ──────────────────────────────────────────────────────────────

    function isRowLleno(row) {
        // Un renglón se considera completo si tiene producto o denominación no vacía (genérico)
        return !!(row.producto || (row.denominacion && row.denominacion.trim() !== ''))
    }

    function isRowVacio(row) {
        return (
            !row.producto &&
            (!row.codigo || row.codigo.trim() === '') &&
            (!row.denominacion || row.denominacion.trim() === '')
        )
    }

    function ensureSoloUnEditable(filas) {
        const result = filas.slice()
        // Eliminar vacíos intermedios
        for (let i = result.length - 2; i >= 0; i--) {
            if (isRowVacio(result[i])) {
                result.splice(i, 1)
            }
        }
        const sinProducto = result.filter((row) => !isRowLleno(row))
        if (sinProducto.length > 1) {
            const lastIdx = result.map((row) => !isRowLleno(row)).lastIndexOf(true)
            if (lastIdx !== -1) {
                result.splice(lastIdx, 1)
            }
        }
        if (result.some((row) => !isRowLleno(row))) {
            const last = result[result.length - 1]
            if (last && !last.id) {
                last.id = generarIdTemporal()
            }
            return result
        }
        // Solo agrego un vacío si todos los renglones tienen producto Y NO estamos en readOnly
        if (!readOnly) {
            result.push({ ...crearItemVacio(), id: generarIdTemporal() })
        }
        return result
    }

    // Variante que preserva la fila actualmente editada aunque esté vacía,
    // para no perder el foco cuando se borra el código.
    function ensureSoloUnEditablePreservandoIndice(filas, preserveIdx) {
        let result = filas.slice()
        for (let i = result.length - 2; i >= 0; i--) {
            if (i === preserveIdx) continue
            if (isRowVacio(result[i])) {
                result.splice(i, 1)
                if (i < preserveIdx) preserveIdx = preserveIdx - 1
            }
        }
        const indicesVacios = result
            .map((row, i) => (!isRowLleno(row) ? i : -1))
            .filter((i) => i !== -1)
        if (indicesVacios.length > 1) {
            let candidato = indicesVacios.filter((i) => i !== preserveIdx).pop()
            if (candidato !== undefined) {
                result.splice(candidato, 1)
                if (candidato < preserveIdx) preserveIdx = preserveIdx - 1
            }
        }
        if (result.some((row) => !isRowLleno(row))) {
            const last = result[result.length - 1]
            if (last && !last.id) {
                last.id = generarIdTemporal()
            }
            return result
        }
        if (!readOnly) {
            result.push({ ...crearItemVacio(), id: generarIdTemporal() })
        }
        return result
    }

    // Helper para interpretar números decimales con punto o coma como separador
    const parsearNumeroFlexible = (cadena) => {
        if (cadena === null || cadena === undefined) return NaN
        const texto = String(cadena).trim()
        if (texto === '') return NaN
        const reemplazado = texto.replace(/,/g, '.')
        const partes = reemplazado.split('.')
        if (partes.length === 1) {
            const entero = partes[0].replace(/[^\d-]/g, '')
            return entero === '' || entero === '-' ? NaN : Number(entero)
        }
        const decimales = partes.pop().replace(/[^\d]/g, '')
        const enteros = partes.join('').replace(/[^\d-]/g, '')
        const combinado = enteros + '.' + decimales
        return combinado === '.' || combinado === '-.' ? NaN : Number(combinado)
    }

    // ──────────────────────────────────────────────────────────────
    // Detección de duplicados
    // ──────────────────────────────────────────────────────────────

    const getDuplicadoMap = (currentRows) => {
        const map = {}
        currentRows.forEach((row, idx) => {
            if (!row.producto) return
            const key = `${row.producto.id}`
            if (!map[key]) map[key] = []
            map[key].push(idx)
        })
        return map
    }

    const isDuplicado = (row, idx, currentRows) => {
        if (!row.producto) return false
        const key = `${row.producto.id}`
        const dMap = getDuplicadoMap(currentRows)
        return dMap[key] && dMap[key].length > 1 && dMap[key].indexOf(idx) !== 0
    }

    // ──────────────────────────────────────────────────────────────
    // Inicialización del estado (rows)
    // ──────────────────────────────────────────────────────────────

    const [rows, setRows] = useState(() => {
        if (Array.isArray(initialItems) && initialItems.length > 0) {
            // Normalizar todos los items del backend usando crearItemDesdeBackend
            let baseRows = initialItems.map(item => crearItemDesdeBackend(item, { aliMap }))

            // Verificar si ya existe un renglón vacío
            const hayVacio = baseRows.some((row) => {
                const noTieneProducto = !row.producto || !row.producto.id
                const noTieneDenominacion = !row.denominacion || row.denominacion.trim() === ''
                return noTieneProducto && noTieneDenominacion
            })

            if (!hayVacio && !readOnly) {
                baseRows = [...baseRows, crearItemVacio()]
            }

            return baseRows
        }

        return readOnly ? [] : [crearItemVacio()]
    })

    // ──────────────────────────────────────────────────────────────
    // Sincronización de precios al cambiar lista de precios
    // ──────────────────────────────────────────────────────────────

    useEffect(() => {
        setRows((prevRows) => {
            let huboCambios = false
            const nuevasFilas = prevRows.map((row) => {
                // No actualizar ítems bloqueados, genéricos o con precio editado manualmente
                if (!row.producto || row.esBloqueado || row.precioEditadoManualmente) return row

                const nuevoPrecioFinal = obtenerPrecioBaseProducto(row.producto)

                // CORRECCIÓN: Si el precio calculado es 0 pero el ítem ya tiene precio > 0,
                // significa que el producto es un stub (sin datos reales de proveedor/lista).
                // No sobreescribir el precio existente para preservar precios históricos.
                if (nuevoPrecioFinal === 0 && Number(row.precioFinal || 0) > 0) return row

                const aliPorc = obtenerPorcentajeIVA(row.idaliiva, aliMap)
                const nuevoPrecioNeto = Math.round((nuevoPrecioFinal / (1 + aliPorc / 100)) * 10000) / 10000

                if (row.precioFinal !== nuevoPrecioFinal || Math.abs((row.precio || 0) - nuevoPrecioNeto) > 0.001) {
                    huboCambios = true
                    return {
                        ...row,
                        precio: nuevoPrecioNeto,
                        precioFinal: nuevoPrecioFinal
                    }
                }
                return row
            })

            return huboCambios ? nuevasFilas : prevRows
        })
    }, [listaPrecioId, obtenerPrecioBaseProducto, aliMap])

    // ──────────────────────────────────────────────────────────────
    // Auto-focus al montar
    // ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (didAutoFocusRef.current) return
        if (rows.length > 0 && isRowVacio(rows[0]) && (!rows[0].codigo || rows[0].codigo === '')) {
            if (codigoRefs.current[0]) {
                codigoRefs.current[0].focus()
                didAutoFocusRef.current = true
            }
        }
    }, [rows])

    // ──────────────────────────────────────────────────────────────
    // Focus effects
    // ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (idxCantidadFoco !== null) {
            if (cantidadRefs.current[idxCantidadFoco]) {
                cantidadRefs.current[idxCantidadFoco].focus()
            }
            setIdxCantidadFoco(null)
        }
    }, [rows, idxCantidadFoco])

    useEffect(() => {
        if (idxCodigoSiguienteFoco !== null) {
            const idxRenglonVacio = rows.findIndex((row, i) => i > idxCodigoSiguienteFoco && isRowVacio(row))
            if (idxRenglonVacio !== -1 && codigoRefs.current[idxRenglonVacio]) {
                codigoRefs.current[idxRenglonVacio].focus()
            }
            setIdxCodigoSiguienteFoco(null)
        }
    }, [rows, idxCodigoSiguienteFoco])

    // Notificar al padre cuando cambien los rows
    const onRowsChangeRef = useRef(onRowsChange)
    useEffect(() => { onRowsChangeRef.current = onRowsChange }, [onRowsChange])
    useEffect(() => { onRowsChangeRef.current?.(rows) }, [rows])

    // ──────────────────────────────────────────────────────────────
    // Handlers: Agregar ítem con manejo de duplicados
    // ──────────────────────────────────────────────────────────────

    const addItemWithDuplicado = useCallback(
        (producto, proveedorId, cantidad = 1) => {
            if (readOnly) return

            // MEJORA: Excluir items originales de la detección de duplicados
            const idxExistente = rows.findIndex((r) => r.producto && r.producto.id === producto.id && !r.esBloqueado && !r.idOriginal)
            if (idxExistente !== -1) {
                if (autoSumarDuplicados === 'sumar') {
                    setRows((rows) =>
                        rows.map((row, i) => (i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidad } : row)),
                    )
                    setIdxCantidadFoco(idxExistente)
                    return
                }
                if (autoSumarDuplicados === 'eliminar') {
                    setRows((rows) => rows.filter((_, i) => i !== idxExistente))
                    return
                }
                if (autoSumarDuplicados === 'duplicar') {
                    setRows((prevRows) => {
                        const lastRow = prevRows[prevRows.length - 1]
                        const nuevoItem = {
                            ...crearItemDesdeProducto(producto, { aliMap, listaPrecioId, listasPrecio, cantidad }),
                            ...lastRow,
                            ...crearItemDesdeProducto(producto, { aliMap, listaPrecioId, listasPrecio, cantidad }),
                        }
                        const nuevaLista = [...prevRows.slice(0, idxExistente), nuevoItem, ...prevRows.slice(idxExistente)]
                        setIdxCantidadFoco(idxExistente)
                        return nuevaLista
                    })
                    return
                }
                return
            }
            setRows((prevRows) => {
                const lastRow = prevRows[prevRows.length - 1]
                const nuevoItem = crearItemDesdeProducto(producto, { aliMap, listaPrecioId, listasPrecio, cantidad })

                if (!lastRow.producto && !lastRow.codigo) {
                    const indiceInsertado = prevRows.length - 1
                    const result = [...prevRows.slice(0, -1), nuevoItem, crearItemVacio()]
                    setIdxCantidadFoco(indiceInsertado)
                    return result
                } else {
                    const indiceInsertado = prevRows.length
                    const result = [...prevRows, nuevoItem, crearItemVacio()]
                    setIdxCantidadFoco(indiceInsertado)
                    return result
                }
            })
        },
        [autoSumarDuplicados, aliMap, rows, readOnly, listaPrecioId, listasPrecio],
    )

    // ──────────────────────────────────────────────────────────────
    // Handler: Agregar ítem desde buscador
    // ──────────────────────────────────────────────────────────────

    const handleAddItem = useCallback(
        (producto) => {
            if (!producto || readOnly) return
            addItemWithDuplicado(producto, null, 1)
        },
        [addItemWithDuplicado, readOnly],
    )

    // ──────────────────────────────────────────────────────────────
    // Handler: Cambio de campo en una fila
    // ──────────────────────────────────────────────────────────────

    const handleRowChange = (idx, field, value) => {
        setRows((prevRows) => {
            const newRows = [...prevRows]
            if (field === 'codigo') {
                const inputCodigo = codigoRefs.current[idx]
                if (inputCodigo && inputCodigo.setCustomValidity) {
                    inputCodigo.setCustomValidity('')
                }
                newRows[idx] = {
                    ...newRows[idx],
                    codigo: value,
                    ...(value.trim() === ''
                        ? {
                            producto: null,
                            denominacion: '',
                            unidad: '',
                            precio: '',
                            cantidad: 1,
                            bonificacion: 0,
                            proveedorId: null,
                            idSto: null,
                            vdi_idsto: null,
                        }
                        : {}),
                }
                return ensureSoloUnEditablePreservandoIndice(newRows, idx)
            } else if (field === 'precio') {
                const userInput = value
                const fila = { ...newRows[idx] }
                const esGenerico = !fila.producto

                const valorNormalizado = parsearNumeroFlexible(userInput)
                const esVacio = String(userInput).trim() === ''
                const userInputNum = Number.isNaN(valorNormalizado) ? 0 : valorNormalizado

                let aliFinalId = fila.idaliiva ?? 3
                // Autoseleccionar IVA 21% para genéricos si se ingresa un precio
                if (esGenerico && userInputNum > 0 && (aliFinalId === 3 || aliFinalId === 0)) {
                    aliFinalId = 5 // ID para 21%
                } else if (esGenerico && (esVacio || userInputNum === 0)) {
                    aliFinalId = 3 // ID para 0%
                }

                const aliFinalPorc = aliMap[aliFinalId] || 0
                const divisorIVA = 1 + (aliFinalPorc / 100)
                const precioBaseCalc = divisorIVA !== 0 ? (userInputNum / divisorIVA) : 0

                if (esGenerico) {
                    fila.vdi_costo = Number.isFinite(precioBaseCalc) ? precioBaseCalc : 0
                    fila.margen = 0
                } else {
                    const costo = Number.parseFloat(fila.vdi_costo ?? fila.producto?.costo ?? 0)
                    if (costo > 0) {
                        const margenNuevo = ((precioBaseCalc - costo) / costo) * 100
                        fila.margen = Number.isFinite(margenNuevo) ? Number(margenNuevo.toFixed(2)) : 0
                    } else {
                        fila.margen = 0
                    }
                }

                fila.precioFinal = esVacio ? '' : userInput
                fila.precio = esVacio ? '' : (Number.isFinite(precioBaseCalc) ? Number(precioBaseCalc.toFixed(4)) : '')
                fila.idaliiva = aliFinalId
                fila.precioEditadoManualmente = !esVacio

                newRows[idx] = fila
                return ensureSoloUnEditable(newRows)
            } else if (field === 'bonificacion') {
                newRows[idx] = { ...newRows[idx], [field]: value }
                return ensureSoloUnEditable(newRows)
            } else if (field === 'denominacion') {
                newRows[idx] = { ...newRows[idx], denominacion: value }
                return ensureSoloUnEditable(newRows)
            }
            return newRows
        })
    }

    // ──────────────────────────────────────────────────────────────
    // Handler: Cambio de cantidad
    // ──────────────────────────────────────────────────────────────

    const handleCantidadChange = (idx, cantidad) => {
        if (modo === 'presupuesto') {
            setRows((prevRows) => {
                const newRows = prevRows.map((row, i) => (i === idx ? { ...row, cantidad } : row))
                onRowsChange?.(newRows)
                return newRows
            })
            return
        }
        setRows((prevRows) => {
            const newRows = prevRows.map((row, i) => (i === idx ? { ...row, cantidad } : row))
            onRowsChange?.(newRows)
            return newRows
        })
        const row = rows[idx]
        const proveedorHabitual = row.producto?.stock_proveedores?.find(
            sp => sp.proveedor?.id === row.producto?.proveedor_habitual?.id
        )
        const totalStock = proveedorHabitual ? Number(proveedorHabitual.cantidad) : 0
        const totalCantidad = rows.reduce((sum, r, i) => {
            if (r.producto && r.producto.id === row.producto?.id) {
                return sum + (i === idx ? Number(cantidad) : Number(r.cantidad))
            }
            return sum
        }, 0)
        if (totalCantidad > totalStock) {
            setStockNegativo(true)
        } else {
            setStockNegativo(false)
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Handler: Enter/Tab en campo (búsqueda + duplicados + foco)
    // ──────────────────────────────────────────────────────────────

    const handleRowKeyDown = async (e, idx, field) => {
        if (e.key === 'Enter' || (e.key === 'Tab' && field === 'bonificacion')) {
            const row = rows[idx]
            if (field === 'codigo' && row.codigo) {
                if (procesandoCodigoRef.current) return
                registrarEventoCodigo({
                    rowId: row.id,
                    codigo: row.codigo,
                    origen: 'keydown',
                })
                procesandoCodigoRef.current = true
                try {
                    const prod = await buscarProductoPorCodigo(row.codigo, {
                        origen: 'keydown',
                        idx,
                        rowId: row.id,
                    })
                    if (!prod) {
                        const inputCodigo = codigoRefs.current[idx]
                        if (inputCodigo && inputCodigo.setCustomValidity) {
                            inputCodigo.setCustomValidity('No se encontró el código de producto')
                            inputCodigo.reportValidity()
                        }
                        e.preventDefault()
                        e.stopPropagation()
                        return
                    }
                    aplicarProductoResueltoEnFila(idx, row, prod, { moverFoco: true })
                } finally {
                    procesandoCodigoRef.current = false
                }
            }
            if (field === 'cantidad') {
                if (rows[idx].producto && rows[idx].codigo) {
                    const idxRenglonVacio = rows.findIndex((row, i) => i > idx && isRowVacio(row))
                    if (idxRenglonVacio !== -1) {
                        setTimeout(() => {
                            if (codigoRefs.current[idxRenglonVacio]) codigoRefs.current[idxRenglonVacio].focus()
                        }, 0)
                    }
                }
            }
            if (field === 'precio') {
                setTimeout(() => {
                    if (bonificacionRefs.current[idx]) bonificacionRefs.current[idx].focus()
                }, 0)
            }
            if (field === 'bonificacion') {
                if (rows[idx].producto && rows[idx].codigo) {
                    const idxRenglonVacio = rows.findIndex((row, i) => i > idx && isRowVacio(row))
                    if (idxRenglonVacio !== -1) {
                        setTimeout(() => {
                            if (codigoRefs.current[idxRenglonVacio]) codigoRefs.current[idxRenglonVacio].focus()
                        }, 0)
                    }
                }
            }
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Handler: Blur del campo código (carga alternativa al Enter)
    // ──────────────────────────────────────────────────────────────

    const handleCodigoBlur = async (idx) => {
        if (procesandoCodigoRef.current) return
        const input = codigoRefs.current[idx]
        if (input && input.setCustomValidity) {
            input.setCustomValidity('')
        }

        const row = rows[idx]
        const codigo = (row.codigo || '').toString().trim()
        if (!codigo) return
        if (debeSuprimirBlurCodigo(row.id, codigo)) return

        const prod = await buscarProductoPorCodigo(codigo, {
            origen: 'blur',
            idx,
            rowId: row.id,
        })
        if (!prod) {
            if (input && input.setCustomValidity && input.reportValidity) {
                input.setCustomValidity('No se encontró el código de producto')
                input.reportValidity()
            }
            restaurarCodigoSiLaFilaTieneProducto(idx)
            return
        }
        aplicarProductoResueltoEnFila(idx, row, prod, { moverFoco: false })
    }

    // ──────────────────────────────────────────────────────────────
    // Handlers: Eliminar, duplicar, IVA
    // ──────────────────────────────────────────────────────────────

    const handleDeleteRow = (idx) => {
        const row = rows[idx]
        if (row.esBloqueado) {
            alert('Este ítem proviene del comprobante original y no puede ser eliminado para mantener la trazabilidad de la conversión.')
            return
        }

        setRows((rows) => {
            const newRows = rows.filter((_, i) => i !== idx)
            if (newRows.every(row => !isRowLleno(row))) {
                return readOnly ? [] : [crearItemVacio()]
            }
            const last = newRows[newRows.length - 1]
            if (last && isRowLleno(last)) {
                return readOnly ? newRows : [...newRows, crearItemVacio()]
            }
            return newRows
        })
    }

    const handleDuplicarRow = (idx) => {
        setRows((prevRows) => {
            const rowToDuplicate = { ...prevRows[idx], id: generarIdTemporal() }
            return [
                ...prevRows.slice(0, idx + 1),
                rowToDuplicate,
                ...prevRows.slice(idx + 1),
            ]
        })
    }

    // Manejar cambio de alícuota en ítem genérico procurando mantener constante el precio final
    const handleIvaChange = (idx, nuevoIdAli) => {
        setRows(prevRows => {
            const nuevos = [...prevRows]
            const fila = { ...nuevos[idx] }
            const aliViejo = aliMap[fila.idaliiva] || 0
            const aliNuevo = aliMap[nuevoIdAli] || 0
            const precioFinalConst = fila.precioFinal !== undefined && fila.precioFinal !== '' ? Number.parseFloat(fila.precioFinal) : Number.parseFloat(fila.precio || 0) * (1 + aliViejo / 100)

            const divisorIva = 1 + aliNuevo / 100
            const nuevoPrecioBase = divisorIva > 0 ? precioFinalConst / divisorIva : 0

            fila.precioFinal = precioFinalConst
            fila.idaliiva = nuevoIdAli
            fila.precio = Number.isNaN(nuevoPrecioBase) ? 0 : Number(nuevoPrecioBase.toFixed(4))
            nuevos[idx] = fila
            onRowsChange?.(nuevos)
            return nuevos
        })
    }

    // ──────────────────────────────────────────────────────────────
    // Handlers de tooltip
    // ──────────────────────────────────────────────────────────────

    const handleMouseEnterTooltip = (idx, event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setPosicionTooltip({
            x: rect.left + rect.width / 2,
            y: rect.bottom + 5
        })
        setMostrarTooltipOriginal(prev => ({ ...prev, [idx]: true }))
    }

    const handleMouseLeaveTooltip = (idx) => {
        setMostrarTooltipOriginal(prev => ({ ...prev, [idx]: false }))
    }

    // Helper para seleccionar todo el texto al hacer foco en un input
    const manejarFocoSeleccionCompleta = (evento) => {
        if (!evento.target.disabled && !evento.target.readOnly && !readOnly) {
            evento.target.select()
        }
    }

    // ──────────────────────────────────────────────────────────────
    // getItems: Serializa las filas al formato que espera el backend (mapearCamposItem)
    // ──────────────────────────────────────────────────────────────

    const getItems = useCallback(() => {
        return rows
            .filter(r => isRowLleno(r))
            .map((row, idx) => {
                const cantidad = Number.parseFloat(row.cantidad) || 0
                const bonif = Number.parseFloat(row.bonificacion) || 0
                const esStock = !!(row.producto || row.vdi_idsto)

                if (esStock) {
                    const idStock = row.producto?.id ?? row.vdi_idsto
                    const idaliiva = extraerIdAlicuota(row.producto?.idaliiva ?? row.idaliiva ?? 3)
                    const margen = row.margen ?? row.vdi_margen ?? row.producto?.margen ?? 0

                    return {
                        vdi_orden: idx + 1,
                        vdi_idsto: idStock,
                        vdi_cantidad: cantidad,
                        vdi_costo: row.vdi_costo ?? 0,
                        vdi_margen: margen,
                        vdi_bonifica: bonif,
                        vdi_precio_unitario_final: row.precioFinal || null,
                        vdi_detalle1: row.denominacion || '',
                        vdi_detalle2: row.unidad || '',
                        vdi_idaliiva: idaliiva,
                        codigo: row.codigo || String(idStock),
                        producto: row.producto ?? null,
                        proveedorId: row.proveedorId,
                    }
                } else {
                    return {
                        vdi_orden: idx + 1,
                        vdi_idsto: null,
                        vdi_cantidad: cantidad,
                        vdi_costo: Number.parseFloat(row.vdi_costo) || 0,
                        vdi_margen: 0,
                        vdi_precio_unitario_final: row.precioFinal || null,
                        vdi_bonifica: bonif,
                        vdi_detalle1: row.denominacion || '',
                        vdi_detalle2: row.unidad || '',
                        vdi_idaliiva: row.idaliiva ?? 3,
                    }
                }
            })
    }, [rows])

    // ──────────────────────────────────────────────────────────────
    // API pública del hook
    // ──────────────────────────────────────────────────────────────

    return {
        // Estado
        rows,
        setRows,
        stockNegativo,
        modoLector,
        setModoLector,
        aliMap,

        // Refs (para binding en JSX)
        codigoRefs,
        cantidadRefs,
        bonificacionRefs,

        // Handlers de datos
        handleRowChange,
        handleCantidadChange,
        handleRowKeyDown,
        handleCodigoBlur,
        handleDeleteRow,
        handleDuplicarRow,
        handleIvaChange,
        handleAddItem,

        // Handlers de UI
        handleMouseEnterTooltip,
        handleMouseLeaveTooltip,
        manejarFocoSeleccionCompleta,
        mostrarTooltipBonif,
        setMostrarTooltipBonif,
        mostrarTooltipDescuentos,
        setMostrarTooltipDescuentos,
        mostrarTooltipOriginal,
        posicionTooltip,

        // Utilities
        isRowLleno,
        isRowVacio,
        isDuplicado: (row, idx) => isDuplicado(row, idx, rows),
        getItems,
        getRows: () => rows,

        // Para binding en useImperativeHandle
        addItemWithDuplicado,
        obtenerPrecioBaseProducto,
    }
}
