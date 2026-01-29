"use client"

import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { obtenerPrecioParaLista } from "../../utils/calcularPrecioLista"

import { BotonDuplicar, BotonEliminar } from "../Botones"

// Mapa de alícuotas por defecto, se utiliza solo si el backend aún no proveyó datos
const ALICUOTAS_POR_DEFECTO = {
  3: 0,   
  4: 10.5,
  5: 21,
  6: 27,
}

function getEmptyRow() {
  return {
    id: Date.now() + Math.random(),
    codigo: "",
    denominacion: "",
    unidad: "",
    cantidad: 0,          // Para genéricos comienza en 0
    precio: "",              // Precio sin IVA (interno)
    precioFinal: "",         // Precio unitario final con IVA que se muestra y envía
    bonificacion: 0,
    producto: null,
    idaliiva: 3,          // 0 % por defecto
    // CORRECCIÓN: Inicializar explícitamente todos los campos de ID como null
    proveedorId: null,
    vdi_idsto: null,
    vdi_idpro: null,
    idSto: null,
    vdi_costo: null,
    margen: null,
  }
}

const ItemsGridPresupuesto = forwardRef(
  (
    {
      autoSumarDuplicados,
      setAutoSumarDuplicados,
      bonificacionGeneral,
      setBonificacionGeneral,
      modo = "presupuesto", // por defecto, para distinguir entre venta y presupuesto
      onRowsChange,
      initialItems,
      descu1 = 0,
      descu2 = 0,
      descu3 = 0,
      totales = {},
      alicuotas = {}, // Mapa { id: porcentaje }
      setDescu1 = () => {},
      setDescu2 = () => {},
      setDescu3 = () => {},
      readOnly = false, // NUEVO: Prop para deshabilitar todo el grid
      listaPrecioId = 0, // Número de lista de precios activa (0=Minorista por defecto)
      listasPrecio = [], // Configuración de listas de precios [{numero, margen_descuento, ...}]
    },
    ref,
      ) => {
    // Hook del tema de FerreDesk
    const theme = useFerreDeskTheme();
    
    // Helper para obtener precio según lista de precios activa
    // Usa la utilidad importada con fallback al cálculo legacy (costo + margen)
    const obtenerPrecioBaseProducto = useCallback((producto, proveedorHabitual) => {
      // Primero intentar obtener precio de la lista activa
      let precioBase = obtenerPrecioParaLista(producto, listaPrecioId, listasPrecio)
      
      // Fallback: si no hay precio de lista, usar cálculo legacy (costo + margen)
      if (!precioBase) {
        const costoNum = Number.parseFloat(proveedorHabitual?.costo ?? 0) || 0
        const margenNum = Number.parseFloat(producto?.margen ?? 0) || 0
        precioBase = costoNum * (1 + margenNum / 100)
      }
      
      return Math.round(precioBase * 100) / 100
    }, [listaPrecioId, listasPrecio]);
    
    // ------------------------------------------------------------
    // Búsqueda remota por código (ventas/presupuesto/NC)
    // Usa el ViewSet de Stock: GET /api/productos/stock/?codvta=<codigo>
    // Ahora incluye información del proveedor habitual
    // ------------------------------------------------------------
    const buscarProductoPorCodigo = useCallback(async (codigo) => {
      // En modo readOnly, no buscar productos
      if (readOnly) return null
      
      const codigoTrim = (codigo || '').toString().trim()
      if (!codigoTrim) return null
      try {
        const url = `/api/productos/stock/?codvta=${encodeURIComponent(codigoTrim)}`
        const resp = await fetch(url, { credentials: 'include' })
        if (!resp.ok) return null
        const data = await resp.json()
        const lista = Array.isArray(data) ? data : (data.results || [])
        if (!Array.isArray(lista) || lista.length === 0) return null
        // Elegir coincidencia exacta por codvta si existe, ignorando mayúsculas/minúsculas
        const exacta = lista.find(p => (p.codvta || p.codigo || '').toString().toLowerCase() === codigoTrim.toLowerCase())
        return exacta || lista[0]
      } catch (_) {
        return null
      }
    }, [readOnly])
    
    // Eliminado: auto-hidratación de initialItems. El fetch solo ocurre en Enter o Blur del campo código.


    // Combinar alícuotas del backend con un fallback seguro
    const aliMap = Object.keys(alicuotas || {}).length ? alicuotas : ALICUOTAS_POR_DEFECTO

    const [rows, setRows] = useState(() => {
      // Los items que llegan a través de `initialItems` vienen crudos del backend
      // ItemsGrid se encarga de hidratarlos usando carga por demanda
      if (Array.isArray(initialItems) && initialItems.length > 0) {
        // Mapear los items del backend a los campos que espera la interfaz
        let baseRows = initialItems.map(item => {
          // CORRECCIÓN: Un item solo es genérico si no tiene vdi_idsto Y tampoco tiene un objeto producto
          // Esto evita que items de stock recargados desde la caché se clasifiquen incorrectamente como genéricos
          const esGenerico = !item.vdi_idsto && !item.producto
          if (esGenerico) {
            // Ítem genérico: mapear a los campos del grid
            return {
              ...item,
              denominacion: item.vdi_detalle1 || item.denominacion || "",
              unidad: item.vdi_detalle2 || item.unidad || "",
              codigo: item.codigo || "",
              cantidad: item.vdi_cantidad || item.cantidad || 0,
              precio: item.vdi_precio_unitario_final || item.precio || 0,
              precioFinal: item.vdi_precio_unitario_final || item.precioFinal || 0,
              bonificacion: item.vdi_bonifica || item.bonificacion || 0,
              idaliiva: item.vdi_idaliiva || item.idaliiva || 3,
              producto: null,
              proveedorId: item.proveedorId ?? null,
            }
          }
          // Ítem de stock: preservar producto existente; si falta, crear stub desde IDs disponibles
          const idaliivaStub = item.vdi_idaliiva ?? item.idaliiva ?? (item.producto?.idaliiva?.id ?? item.producto?.idaliiva ?? 3)
          const margenStub = item.vdi_margen ?? item.margen ?? (item.producto?.margen ?? 0)
          const vdiId = item.vdi_idsto ?? item.idSto ?? item.idsto ?? item.producto?.id ?? null
          const productoFinal = item.producto
            ? item.producto
            : {
                id: vdiId,
                idaliiva: idaliivaStub,
                margen: margenStub,
                codvta: item.codigo ?? item.vdi_codigo ?? (vdiId != null ? String(vdiId) : ''),
                codigo: item.codigo ?? item.vdi_codigo ?? (vdiId != null ? String(vdiId) : ''),
                deno: item.denominacion || item.vdi_detalle1 || '',
                nombre: item.denominacion || item.vdi_detalle1 || '',
                unidad: item.unidad || item.vdi_detalle2 || '-',
                unidadmedida: item.unidad || item.vdi_detalle2 || '-',
                stock_proveedores: [],
                proveedor_habitual: null,
              }
          return {
            ...item,
            vdi_idsto: vdiId,
            producto: productoFinal,
            codigo: item.codigo ?? item.vdi_codigo ?? productoFinal.codvta ?? productoFinal.codigo ?? (vdiId != null ? String(vdiId) : ''),
            denominacion: item.denominacion || item.vdi_detalle1 || productoFinal.deno || productoFinal.nombre || '',
            unidad: item.unidad || item.vdi_detalle2 || productoFinal.unidad || productoFinal.unidadmedida || '-',
            cantidad: item.vdi_cantidad ?? item.cantidad ?? 1,
            precio: item.vdi_precio_unitario_final ?? item.precio ?? '',
            precioFinal: item.vdi_precio_unitario_final ?? item.precioFinal ?? '',
            bonificacion: item.vdi_bonifica ?? item.bonificacion ?? 0,
            idaliiva: idaliivaStub,
            vdi_costo: item.vdi_costo ?? item.costo ?? item.producto?.costo ?? null,
            proveedorId: item.proveedorId ?? item.vdi_idpro ?? item.producto?.proveedor_habitual?.id ?? null,
          }
        })

        

        // Verificar si ya existe un renglón vacío; si no, añadir uno para permitir nuevas cargas
        const hayVacio = baseRows.some(
          (row) => {
            // Un renglón está vacío si no tiene ningún contenido significativo
            const noTieneProducto = !row.producto || !row.producto.id;
            const noTieneDenominacion = !row.denominacion || row.denominacion.trim() === "";
            const noTieneDetalle = !row.vdi_detalle1 || row.vdi_detalle1.trim() === "";
            // Es un renglón vacío si no tiene ningún contenido significativo
            // NOTA: Los items genéricos pueden tener codigo "-" pero sí tienen denominacion
            return noTieneProducto && noTieneDenominacion && noTieneDetalle;
          }
        );
        
        if (!hayVacio && !readOnly) {
          baseRows = [...baseRows, getEmptyRow()];
        }
        
        
        return baseRows;
      }
      
      
      return readOnly ? [] : [getEmptyRow()];
    })
    const [stockNegativo, setStockNegativo] = useState(false)
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const bonificacionRefs = useRef([])
    const didAutoFocusRef = useRef(false)
    // Flag para evitar doble procesamiento entre Enter/Tab y Blur
    const procesandoCodigoRef = useRef(false)
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)
    const [mostrarTooltipBonif, setMostrarTooltipBonif] = useState(false)
    const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false)
  const [mostrarTooltipOriginal, setMostrarTooltipOriginal] = useState({})
  const [posicionTooltip, setPosicionTooltip] = useState({ x: 0, y: 0 })

    const addItemWithDuplicado = useCallback(
      (producto, proveedorId, cantidad = 1) => {
        // No agregar items en modo readOnly
        if (readOnly) return
        
        // MEJORA: Excluir items originales (esBloqueado o idOriginal) de la detección de duplicados
        // para que "Sumar Cantidades" no funcione con items originales
        const idxExistente = rows.findIndex((r) => r.producto && r.producto.id === producto.id && !r.esBloqueado && !r.idOriginal)
        if (idxExistente !== -1) {
          if (autoSumarDuplicados === "sumar") {
            setRows((rows) =>
              rows.map((row, i) => (i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidad } : row)),
            )
            // Después de sumar en duplicado, mover el foco a la cantidad del ítem afectado
            setIdxCantidadFoco(idxExistente)
            return
          }
          if (autoSumarDuplicados === "eliminar") {
            setRows((rows) => rows.filter((_, i) => i !== idxExistente))
            return
          }
          if (autoSumarDuplicados === "duplicar") {
            setRows((prevRows) => {
              const lastRow = prevRows[prevRows.length - 1]
              
// Buscar el proveedor habitual en stock_proveedores
                const proveedorHabitual = producto.stock_proveedores?.find(
                  sp => sp.proveedor?.id === producto.proveedor_habitual?.id
                )

                // -------------------------------------------------------------
                // Cálculo del precio base usando lista de precios activa
                // Si no hay precio de lista, fallback a costo + margen
                // -------------------------------------------------------------
                const aliIdTmp = typeof producto.idaliiva === 'object' ? producto.idaliiva.id : (producto.idaliiva ?? 3)
                const aliPorcTmp = aliMap[aliIdTmp] || 0
                const costoNum = Number.parseFloat(proveedorHabitual?.costo ?? 0) || 0
                const margenNum = Number.parseFloat(producto?.margen ?? 0) || 0

                const precioBaseTmp = obtenerPrecioBaseProducto(producto, proveedorHabitual)
                const precioFinalTmp = Math.round((precioBaseTmp * (1 + aliPorcTmp / 100)) * 100) / 100

              const nuevoItem = {
                id: Date.now() + Math.random(),
                ...lastRow,
                codigo: producto.codvta || producto.codigo || "",
                denominacion: producto.deno || producto.nombre || "",
                unidad: producto.unidad || producto.unidadmedida || "-",
                precio: precioBaseTmp,
                precioFinal: precioFinalTmp,
                vdi_costo: costoNum,
                margen: margenNum,
                cantidad,
                bonificacion: 0,
                producto: producto,
                idaliiva: aliIdTmp,
                proveedorId: producto.proveedor_habitual?.id || null,
              }
              const nuevaLista = [...prevRows.slice(0, idxExistente), nuevoItem, ...prevRows.slice(idxExistente)]
              // Nuevo ítem duplicado insertado en idxExistente → foco en cantidad de ese índice
              setIdxCantidadFoco(idxExistente)
              return nuevaLista
            })
            return
          }
          return
        }
        setRows((prevRows) => {
          const lastRow = prevRows[prevRows.length - 1]
          
          // Buscar el proveedor habitual en stock_proveedores para obtener costo y precio
          const proveedorHabitual = producto.stock_proveedores?.find(
            sp => sp.proveedor?.id === producto.proveedor_habitual?.id
          )

          // --- Cálculo precio base usando lista de precios activa ---
          const margenTmp = Number.parseFloat(producto?.margen ?? 0) || 0
          const costoTmp = Number.parseFloat(proveedorHabitual?.costo ?? 0) || 0
          const aliIdTmp = typeof producto.idaliiva === 'object' ? producto.idaliiva.id : (producto.idaliiva ?? 3)
          const aliPorcTmp = aliMap[aliIdTmp] || 0

          const precioBaseTmp = obtenerPrecioBaseProducto(producto, proveedorHabitual)
          const precioFinalTmp = Math.round((precioBaseTmp * (1 + aliPorcTmp / 100)) * 100) / 100

          const nuevoItem = {
            id: Date.now() + Math.random(),
            ...lastRow,
            codigo: producto.codvta || producto.codigo || "",
            denominacion: producto.deno || producto.nombre || "",
            unidad: producto.unidad || producto.unidadmedida || "-",
            precio: precioBaseTmp,
            precioFinal: precioFinalTmp,
            vdi_costo: costoTmp,
            margen: margenTmp,
            cantidad,
            bonificacion: 0,
            producto: producto,
            idaliiva: aliIdTmp,
            proveedorId: producto.proveedor_habitual?.id || null,
          }
          if (!lastRow.producto && !lastRow.codigo) {
            const indiceInsertado = prevRows.length - 1
            const result = [...prevRows.slice(0, -1), nuevoItem, getEmptyRow()]
            // Foco en cantidad del renglón donde se insertó el nuevo ítem
            setIdxCantidadFoco(indiceInsertado)
            return result
          } else {
            const indiceInsertado = prevRows.length
            const result = [...prevRows, nuevoItem, getEmptyRow()]
            // Foco en cantidad del nuevo renglón agregado
            setIdxCantidadFoco(indiceInsertado)
            return result
          }
        })
      },
      [autoSumarDuplicados, aliMap, rows, readOnly, obtenerPrecioBaseProducto],
    )

    useEffect(() => {
      // Enfocar automáticamente solo una vez al montar, no después de errores de blur
      if (didAutoFocusRef.current) return
      if (rows.length > 0 && isRowVacio(rows[0]) && (!rows[0].codigo || rows[0].codigo === "")) {
        if (codigoRefs.current[0]) {
          codigoRefs.current[0].focus()
          didAutoFocusRef.current = true
        }
      }
    }, [rows])

    function isRowLleno(row) {
      // Un renglón se considera completo si:
      // 1) Tiene un producto seleccionado (ítem de stock)
      // 2) Es un ítem genérico con descripción no vacía
      return !!(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
    }

    function isRowVacio(row) {
      return (
        !row.producto &&
        (!row.codigo || row.codigo.trim() === "") &&
        (!row.denominacion || row.denominacion.trim() === "")
      )
    }

    function ensureSoloUnEditable(rows) {
      const result = rows.slice()
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
      // Si hay algún renglón sin producto, no agrego otro vacío
      if (result.some((row) => !isRowLleno(row))) {
        // Si el último renglón no tiene id, asignar uno único
        const last = result[result.length - 1]
        if (last && !last.id) {
          last.id = Date.now() + Math.random()
        }
        return result
      }
      // Solo agrego un vacío si todos los renglones tienen producto Y NO estamos en modo readOnly
      if (!readOnly) {
        result.push({ ...getEmptyRow(), id: Date.now() + Math.random() })
      }
      return result
    }

    // Variante que preserva la fila actualmente editada aunque esté vacía,
    // para no perder el foco cuando se borra el código.
    function ensureSoloUnEditablePreservandoIndice(rows, preserveIdx) {
      let result = rows.slice()
      // Eliminar vacíos intermedios excepto el que se está editando
      for (let i = result.length - 2; i >= 0; i--) {
        if (i === preserveIdx) continue
        if (isRowVacio(result[i])) {
          result.splice(i, 1)
          if (i < preserveIdx) preserveIdx = preserveIdx - 1
        }
      }
      // Si quedan más de un renglón sin completar, eliminar uno que no sea el preservado
      const indicesVacios = result
        .map((row, i) => (!isRowLleno(row) ? i : -1))
        .filter((i) => i !== -1)
      if (indicesVacios.length > 1) {
        // Intentar eliminar el último vacío que no sea el preservado
        let candidato = indicesVacios.filter((i) => i !== preserveIdx).pop()
        if (candidato !== undefined) {
          result.splice(candidato, 1)
          if (candidato < preserveIdx) preserveIdx = preserveIdx - 1
        }
      }
      // Si hay algún renglón sin producto, no agrego otro vacío
      if (result.some((row) => !isRowLleno(row))) {
        const last = result[result.length - 1]
        if (last && !last.id) {
          last.id = Date.now() + Math.random()
        }
        return result
      }
      // Solo agrego un vacío si todos los renglones tienen producto Y NO estamos en modo readOnly
      if (!readOnly) {
        result.push({ ...getEmptyRow(), id: Date.now() + Math.random() })
      }
      return result
    }

    // Helper para interpretar números decimales con punto o coma como separador
    const parsearNumeroFlexible = (cadena) => {
      if (cadena === null || cadena === undefined) return NaN
      const texto = String(cadena).trim()
      if (texto === "") return NaN
      const reemplazado = texto.replace(/,/g, ".")
      const partes = reemplazado.split(".")
      if (partes.length === 1) {
        const entero = partes[0].replace(/[^\d-]/g, "")
        return entero === "" || entero === "-" ? NaN : Number(entero)
      }
      const decimales = partes.pop().replace(/[^\d]/g, "")
      const enteros = partes.join("").replace(/[^\d-]/g, "")
      const combinado = enteros + "." + decimales
      return combinado === "." || combinado === "-." ? NaN : Number(combinado)
    }

    const handleRowChange = (idx, field, value) => {
      setRows((prevRows) => {
        const newRows = [...prevRows]
        if (field === "codigo") {
          // Limpiar cualquier mensaje de validación previo al modificar el código
          const inputCodigo = codigoRefs.current[idx]
          if (inputCodigo && inputCodigo.setCustomValidity) {
            inputCodigo.setCustomValidity("")
          }
          newRows[idx] = {
            ...newRows[idx],
            codigo: value,
            ...(value.trim() === ""
              ? {
                  producto: null,
                  denominacion: "",
                  unidad: "",
                  precio: "",
                  cantidad: 1,
                  bonificacion: 0,
                  proveedorId: null, // <--- null en vez de ""
                  idSto: null,      // <--- null en vez de ""
                  vdi_idsto: null,  // <--- null en vez de ""
                }
              : {}),
          }
          const updatedRows = ensureSoloUnEditablePreservandoIndice(newRows, idx)
          return updatedRows
        } else if (field === "precio") {
          const userInput = value
          const fila = { ...newRows[idx] }
          const esGenerico = !fila.producto

          const valorNormalizado = parsearNumeroFlexible(userInput)
          const esVacio = String(userInput).trim() === ""
          const userInputNum = Number.isNaN(valorNormalizado) ? 0 : valorNormalizado

          let aliFinalId = fila.idaliiva ?? 3
          // Autoseleccionar IVA 21% para genéricos si se ingresa un precio
          if (esGenerico && userInputNum > 0 && (aliFinalId === 3 || aliFinalId === 0)) {
            aliFinalId = 5 // ID para 21%
          } else if (esGenerico && (esVacio || userInputNum === 0)) {
            aliFinalId = 3 // ID para 0%
          }

          const aliFinalPorc = aliMap[aliFinalId] || 0

          // Si el usuario ingresa un precio FINAL (con IVA), para obtener
          // el precio base sin IVA debemos DIVIDIR por (1 + IVA/100)
          const divisorIVA = 1 + (aliFinalPorc / 100)
          const precioBaseCalc = divisorIVA !== 0 ? (userInputNum / divisorIVA) : 0

          if (esGenerico) {
            // Ítem genérico: el precio base pasa a ser también el costo.
            fila.vdi_costo = Number.isFinite(precioBaseCalc) ? precioBaseCalc : 0
            fila.margen = 0
          } else {
            // Ítem de stock: el costo permanece fijo; recalculamos margen.
            const costo = Number.parseFloat(fila.vdi_costo ?? fila.producto?.costo ?? 0)
            if (costo > 0) {
              const margenNuevo = ((precioBaseCalc - costo) / costo) * 100
              fila.margen = Number.isFinite(margenNuevo) ? Number(margenNuevo.toFixed(2)) : 0
            } else {
              fila.margen = 0
            }
          }

          fila.precioFinal = esVacio ? "" : userInput
          // Guardar precio base con 4 decimales para evitar errores de redondeo
          fila.precio = esVacio ? "" : (Number.isFinite(precioBaseCalc) ? Number(precioBaseCalc.toFixed(4)) : "")
          fila.idaliiva = aliFinalId

          newRows[idx] = fila
          const updatedRows = ensureSoloUnEditable(newRows)
          return updatedRows
        } else if (field === "bonificacion") {
          newRows[idx] = {
            ...newRows[idx],
            [field]: value,
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          return updatedRows
        } else if (field === "denominacion") {
          newRows[idx] = {
            ...newRows[idx],
            denominacion: value,
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          return updatedRows
        }
        return newRows
      })
    }

    const handleAddItem = useCallback(
      (producto) => {
        if (!producto || readOnly) return
        const proveedorHabitual = producto.stock_proveedores?.find(
          sp => sp.proveedor?.id === producto.proveedor_habitual?.id
        )
        const proveedorId = proveedorHabitual?.proveedor?.id || null
        const cantidad = 1
        // Permitir agregar siempre, independientemente del stock disponible
        addItemWithDuplicado(producto, proveedorId, cantidad)
      },
      [addItemWithDuplicado, readOnly],
    )

    // En useImperativeHandle, expongo también getRows para acceder siempre al array actualizado
    useImperativeHandle(
      ref,
      () => ({
        getItems: () => {
          return rows
            .filter(r => isRowLleno(r)) // Usamos la función que ya sabe qué es una fila llena
            .map((row, idx) => {
              const cantidad = Number.parseFloat(row.cantidad) || 0;
              const bonif = Number.parseFloat(row.bonificacion) || 0;

              const esStock = !!(row.producto || row.vdi_idsto)
              if (esStock) {
                // --- LÓGICA PARA ÍTEM DE STOCK ---
                const idStock = row.producto?.id ?? row.vdi_idsto
                const idaliiva = row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? row.idaliiva ?? 3
                const margen = row.margen ?? row.vdi_margen ?? row.producto?.margen ?? 0
                
                return {
                  vdi_orden: idx + 1,
                  vdi_idsto: idStock,
                  // vdi_idpro: row.proveedorId, // el backend puede inferir proveedor
                  vdi_cantidad: cantidad,
                  vdi_costo: row.vdi_costo ?? 0,
                  vdi_margen: margen,
                  vdi_bonifica: bonif,
                  vdi_precio_unitario_final: row.precioFinal || null,
                  vdi_detalle1: row.denominacion || "",
                  vdi_detalle2: row.unidad || "",
                  vdi_idaliiva: idaliiva,
                  codigo: row.codigo || String(idStock),
                  producto: row.producto ?? null,
                  proveedorId: row.proveedorId,
                };
              } else {
                // --- LÓGICA PARA ÍTEM GENÉRICO ---
                return {
                  vdi_orden: idx + 1,
                  vdi_idsto: null,
                  // NUEVO: El backend obtiene automáticamente el proveedor habitual del stock
                  // vdi_idpro: null,
                  vdi_cantidad: cantidad,
                  vdi_costo: Number.parseFloat(row.vdi_costo) || 0,
                  vdi_margen: 0,
                  vdi_precio_unitario_final: row.precioFinal || null,
                  vdi_bonifica: bonif,
                  vdi_detalle1: row.denominacion || "",
                  vdi_detalle2: row.unidad || "",
                  vdi_idaliiva: row.idaliiva ?? 3,
                };
              }
            });
        },
        getRows: () => rows,
        handleAddItem,
        getStockNegativo: () => stockNegativo,
        _debugRows: () => {},
      }),
      [rows, handleAddItem, stockNegativo],
    )

    // handleCantidadChange: Si es presupuesto, solo setea cantidad, sin alertas ni modales
    const handleCantidadChange = (idx, cantidad) => {
      if (modo === "presupuesto") {
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

    // Funciones para manejar el tooltip flotante
    const handleMouseEnterTooltip = (idx, event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosicionTooltip({
        x: rect.left + rect.width / 2, // Centro del indicador
        y: rect.bottom + 5 // Debajo del indicador
      });
      setMostrarTooltipOriginal(prev => ({...prev, [idx]: true}));
    };

    const handleMouseLeaveTooltip = (idx) => {
      setMostrarTooltipOriginal(prev => ({...prev, [idx]: false}));
    };

    // Eliminar ítem y dejar solo un renglón vacío si no quedan ítems
    const handleDeleteRow = (idx) => {
      const row = rows[idx];
      
      // NUEVO: Verificar si el item está bloqueado
      if (row.esBloqueado) {
        alert('Este ítem proviene del comprobante original y no puede ser eliminado para mantener la trazabilidad de la conversión.');
        return;
      }
      
      setRows((rows) => {
        const newRows = rows.filter((_, i) => i !== idx);

        // Si después de eliminar, no queda ninguna fila "llena" (ni de stock ni genérica),
        // entonces reiniciamos la grilla a un único renglón vacío (solo si no estamos en readOnly).
        if (newRows.every(row => !isRowLleno(row))) {
          return readOnly ? [] : [getEmptyRow()];
        }

        // Si la última fila está llena, nos aseguramos de que haya una vacía debajo (solo si no estamos en readOnly).
        const last = newRows[newRows.length - 1];
        if (last && isRowLleno(last)) {
          return readOnly ? newRows : [...newRows, getEmptyRow()];
        }
        
        // Si no, simplemente devolvemos las filas actualizadas (ej. el último ya era vacío).
        return newRows;
      });
    };

    const handleDuplicarRow = (idx) => {
      setRows((prevRows) => {
        const rowToDuplicate = { ...prevRows[idx], id: Date.now() + Math.random() };
        const newRows = [
          ...prevRows.slice(0, idx + 1),
          rowToDuplicate,
          ...prevRows.slice(idx + 1),
        ];
        return newRows;
      });
    };

    // 1. Reescribir isDuplicado para que sea robusto y solo resalte la celda de cantidad
    const getDuplicadoMap = () => {
      const map = {}
      rows.forEach((row, idx) => {
        if (!row.producto || !row.proveedorId) return
        const key = `${row.producto.id}_${row.proveedorId}`
        if (!map[key]) map[key] = []
        map[key].push(idx)
      })
      return map
    }
    const duplicadoMap = getDuplicadoMap()
    const isDuplicado = (row, idx) => {
      if (!row.producto || !row.proveedorId) return false
      const key = `${row.producto.id}_${row.proveedorId}`
      return duplicadoMap[key] && duplicadoMap[key].length > 1 && duplicadoMap[key].indexOf(idx) !== 0
    }

    // Definir handleRowKeyDown si no está definida
    const handleRowKeyDown = async (e, idx, field) => {
      if (e.key === "Enter" || (e.key === "Tab" && field === "bonificacion")) {
        const row = rows[idx]
        if (field === "codigo" && row.codigo) {
          if (procesandoCodigoRef.current) return
          procesandoCodigoRef.current = true
          try {
          // Búsqueda remota por código
          const prod = await buscarProductoPorCodigo(row.codigo)
          if (!prod) {
            // Mostrar error si no se encuentra el producto
            const inputCodigo = codigoRefs.current[idx]
            if (inputCodigo && inputCodigo.setCustomValidity) {
              // Mostrar error sin forzar focus ni seleccionar texto
              inputCodigo.setCustomValidity('No se encontró el código de producto')
            }
            return
          }
          
          const proveedorHabitual = prod.stock_proveedores?.find(
            sp => sp.proveedor?.id === prod.proveedor_habitual?.id
          )
          const proveedorId = proveedorHabitual?.proveedor?.id || null
          
          // MEJORA: Excluir items originales (esBloqueado o idOriginal) de la detección de duplicados
          // para que "Sumar Cantidades" no funcione con items originales
          const idxExistente = rows.findIndex(
            (r, i) => i !== idx && r.producto && r.producto.id === prod.id && !r.esBloqueado && !r.idOriginal,
          )
          if (idxExistente !== -1) {
            if (autoSumarDuplicados === "sumar") {
              setRows((rows) => {
                const cantidadASumar = Number(row.cantidad) > 0 ? Number(row.cantidad) : 1;
                const newRows = rows.map((r, i) =>
                  i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + cantidadASumar } : r,
                )
                newRows[idx] = getEmptyRow()
                return ensureSoloUnEditable(newRows)
              })
              setIdxCantidadFoco(idxExistente)
              e.preventDefault()
              e.stopPropagation()
              return
            }
            if (autoSumarDuplicados === "duplicar") {
              setRows((prevRows) => {
                const newRows = [...prevRows]

                // Calcular precio usando lista de precios activa
                const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
                const aliPorc = aliMap[aliId] || 0
                const precioBase = obtenerPrecioBaseProducto(prod, proveedorHabitual)
                const precioFinal = Math.round(precioBase * (1 + aliPorc / 100) * 100) / 100

                const itemCargado = {
                  ...newRows[idx],
                  codigo: prod.codvta || prod.codigo || "",
                  denominacion: prod.deno || prod.nombre || "",
                  unidad: prod.unidad || prod.unidadmedida || "-",
                  precio: precioBase,
                  precioFinal: precioFinal,
                  vdi_costo: (proveedorHabitual?.costo || 0),
                  margen: prod?.margen ?? 0,
                  cantidad: row.cantidad || 1,
                  bonificacion: 0,
                  producto: prod,
                  idaliiva: aliId,
                  proveedorId: proveedorId,
                }
                
                newRows[idx] = itemCargado
                if (newRows.every(isRowLleno) && !readOnly) {
                  newRows.push(getEmptyRow())
                }
                return ensureSoloUnEditable(newRows)
              })
              setIdxCantidadFoco(idx)
              e.preventDefault()
              e.stopPropagation()
              return
            }
            // Si no hay acción válida, no mover foco
            e.preventDefault()
            e.stopPropagation()
            return
          }
          // Si no es duplicado, autocompletar datos y agregar ítem
          setRows((prevRows) => {
            const newRows = [...prevRows]
            const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
            const aliPorc = aliMap[aliId] || 0
            // Usar lista de precios activa para calcular precio
            const precioBase = obtenerPrecioBaseProducto(prod, proveedorHabitual)
            const precioFinal = Math.round(precioBase * (1 + aliPorc / 100) * 100) / 100
            const itemCargado = {
              ...newRows[idx],
              codigo: prod.codvta || prod.codigo || "",
              denominacion: prod.deno || prod.nombre || "",
              unidad: prod.unidad || prod.unidadmedida || "-",
              precio: precioBase,
              precioFinal: precioFinal,
              vdi_costo: (proveedorHabitual?.costo || 0),
              margen: prod?.margen ?? 0,
              cantidad: row.cantidad || 1,
              bonificacion: 0,
              producto: prod,
              idaliiva: aliId,
              proveedorId: proveedorId,
            }
            
            newRows[idx] = itemCargado
            if (newRows.every(isRowLleno) && !readOnly) {
              newRows.push(getEmptyRow())
            }
            return ensureSoloUnEditable(newRows)
          })
          // Mover foco a cantidad después de cargar el producto
          setIdxCantidadFoco(idx)
          } finally {
            // Liberar el flag para permitir futuros procesos
            procesandoCodigoRef.current = false
          }
        }
        if (field === "cantidad") {
          if (rows[idx].producto && rows[idx].codigo) {
            // Buscar el primer renglón vacío disponible
            const idxRenglonVacio = rows.findIndex((row, i) => i > idx && isRowVacio(row))
            if (idxRenglonVacio !== -1) {
              setTimeout(() => {
                if (codigoRefs.current[idxRenglonVacio]) codigoRefs.current[idxRenglonVacio].focus()
              }, 0)
            }
          }
        }
        if (field === "precio") {
          setTimeout(() => {
            if (bonificacionRefs.current[idx]) bonificacionRefs.current[idx].focus()
          }, 0)
        }
        if (field === "bonificacion") {
          if (rows[idx].producto && rows[idx].codigo) {
            // Buscar el primer renglón vacío disponible
            const idxRenglonVacio = rows.findIndex((row, i) => i > idx && isRowVacio(row))
            if (idxRenglonVacio !== -1) {
              setTimeout(() => {
                if (codigoRefs.current[idxRenglonVacio]) codigoRefs.current[idxRenglonVacio].focus()
              }, 0)
            }
          }
        }
      }
      if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Nuevo: al salir del campo código, intentar cargar el producto igual que con Enter
    const handleCodigoBlur = async (idx) => {
      // Evitar reprocesar si ya se manejó por Enter/Tab
      if (procesandoCodigoRef.current) return
      const input = codigoRefs.current[idx]
      if (input && input.setCustomValidity) {
        input.setCustomValidity("")
      }

      const row = rows[idx]
      const codigo = (row.codigo || "").toString().trim()
      if (!codigo) return

      // Búsqueda remota por código
      const prod = await buscarProductoPorCodigo(codigo)
      if (!prod) {
        if (input && input.setCustomValidity && input.reportValidity) {
          input.setCustomValidity('No se encontró el código de producto')
          input.reportValidity()
        }
        // Restaurar el código original si ya hay producto en la fila
        setRows((prev) => {
          const nuevos = [...prev]
          const actual = nuevos[idx]
          if (actual && actual.producto) {
            const codigoOriginal = actual.producto.codvta || actual.producto.codigo || String(actual.producto.id || '')
            nuevos[idx] = { ...actual, codigo: codigoOriginal }
          }
        return nuevos
        })
        return
      }

      const proveedorHabitual = prod.stock_proveedores?.find(
        sp => sp.proveedor?.id === prod.proveedor_habitual?.id
      )
      const proveedorId = proveedorHabitual?.proveedor?.id || null

      // Duplicados: misma lógica que en Enter
      const idxExistente = rows.findIndex(
        (r, i) => i !== idx && r.producto && r.producto.id === prod.id && r.proveedorId === proveedorId && !r.esBloqueado && !r.idOriginal,
      )
      if (idxExistente !== -1) {
        if (autoSumarDuplicados === "sumar") {
          setRows((rs) => {
            const cantidadASumar = Number(row.cantidad) > 0 ? Number(row.cantidad) : 1
            const newRows = rs.map((r, i) => (i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + cantidadASumar } : r))
            newRows[idx] = getEmptyRow()
            return ensureSoloUnEditable(newRows)
          })
          return
        }
        if (autoSumarDuplicados === "duplicar") {
          setRows((prevRows) => {
            const newRows = [...prevRows]
            const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
            const aliPorc = aliMap[aliId] || 0
            // Usar lista de precios activa para calcular precio
            const precioBase = obtenerPrecioBaseProducto(prod, proveedorHabitual)
            const precioFinal = Math.round(precioBase * (1 + aliPorc / 100) * 100) / 100
            const itemCargado = {
              ...newRows[idx],
              codigo: prod.codvta || prod.codigo || "",
              denominacion: prod.deno || prod.nombre || "",
              unidad: prod.unidad || prod.unidadmedida || "-",
              precio: precioBase,
              precioFinal: precioFinal,
              vdi_costo: (proveedorHabitual?.costo || 0),
              margen: prod?.margen ?? 0,
              cantidad: row.cantidad || 1,
              bonificacion: 0,
              producto: prod,
              idaliiva: aliId,
              proveedorId: proveedorId,
            }
            newRows[idx] = itemCargado
            if (newRows.every(isRowLleno) && !readOnly) {
              newRows.push(getEmptyRow())
            }
            return ensureSoloUnEditable(newRows)
          })
          return
        }
        return
      }

      setRows((prevRows) => {
        const newRows = [...prevRows]
        const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
        const aliPorc = aliMap[aliId] || 0
        // Usar lista de precios activa para calcular precio
        const precioBase = obtenerPrecioBaseProducto(prod, proveedorHabitual)
        const precioFinal = Math.round(precioBase * (1 + aliPorc / 100) * 100) / 100
        const itemCargado = {
          ...newRows[idx],
          codigo: prod.codvta || prod.codigo || "",
          denominacion: prod.deno || prod.nombre || "",
          unidad: prod.unidad || prod.unidadmedida || "-",
          precio: precioBase,
          precioFinal: precioFinal,
          vdi_costo: (proveedorHabitual?.costo || 0),
          margen: prod?.margen ?? 0,
          cantidad: row.cantidad || 1,
          bonificacion: 0,
          producto: prod,
          idaliiva: aliId,
          proveedorId: proveedorId,
        }
        newRows[idx] = itemCargado
        if (newRows.every(isRowLleno) && !readOnly) {
          newRows.push(getEmptyRow())
        }
        return ensureSoloUnEditable(newRows)
      })
    }

    // useEffect para mover el foco a cantidad si idxCantidadFoco está seteado
    useEffect(() => {
      if (idxCantidadFoco !== null) {
        if (cantidadRefs.current[idxCantidadFoco]) {
          cantidadRefs.current[idxCantidadFoco].focus()
        }
        setIdxCantidadFoco(null)
      }
    }, [rows, idxCantidadFoco])

    // Mantener referencia estable de onRowsChange para evitar bucles por identidad
    const onRowsChangeRef = useRef(onRowsChange)
    useEffect(() => { onRowsChangeRef.current = onRowsChange }, [onRowsChange])

    // Notificar al padre cuando cambien los rows (solo depende de rows)
    useEffect(() => {
      onRowsChangeRef.current?.(rows)
    }, [rows])

    // Función helper para seleccionar todo el texto al hacer foco en un input
    const manejarFocoSeleccionCompleta = (evento) => {
      // Solo seleccionar si el input no está deshabilitado y no estamos en modo readOnly
      if (!evento.target.disabled && !evento.target.readOnly && !readOnly) {
        evento.target.select()
      }
    }

    // Manejar cambio de alícuota en ítem genérico procurando mantener constante el precio final
    const handleIvaChange = (idx, nuevoIdAli) => {
      setRows(prevRows => {
        const nuevos = [...prevRows]
        const fila = { ...nuevos[idx] }
        const aliViejo = aliMap[fila.idaliiva] || 0
        const aliNuevo = aliMap[nuevoIdAli] || 0
        const precioFinalConst = fila.precioFinal !== undefined && fila.precioFinal !== "" ? Number.parseFloat(fila.precioFinal) : Number.parseFloat(fila.precio || 0) * (1 + aliViejo / 100)
        
        // CORRECCIÓN: Usar división para obtener el precio base desde el precio final
        const divisorIva = 1 + aliNuevo / 100
        const nuevoPrecioBase = divisorIva > 0 ? precioFinalConst / divisorIva : 0

        fila.precioFinal = precioFinalConst
        // Actualizar la alícuota seleccionada para que el <select> muestre el valor correcto
        fila.idaliiva = nuevoIdAli
        // Guardar precio base con 4 decimales para mayor precisión
        fila.precio = Number.isNaN(nuevoPrecioBase) ? 0 : Number(nuevoPrecioBase.toFixed(4))
        nuevos[idx] = fila
        onRowsChange?.(nuevos)
        return nuevos
      })
    }

    // Render con estética FerreDesk
    return (
      <div className="space-y-4 w-full">
        {/* Banner informativo removido para unificar diseño */}
        <div className="grid gap-4 mb-2 items-end" style={{gridTemplateColumns: 'auto auto auto 1fr'}}>
          {/* Bonificación general */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bonificación general (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={bonificacionGeneral}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setBonificacionGeneral(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${
                  readOnly 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400'
                }`}
              />
              <div
                className="relative cursor-pointer"
                onMouseEnter={() => setMostrarTooltipBonif?.(true)}
                onMouseLeave={() => setMostrarTooltipBonif?.(false)}
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-3.5 h-3.5 text-slate-600"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                {mostrarTooltipBonif && (
                  <div className="absolute left-8 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    La bonificación general solo se aplica a ítems sin bonificación particular.
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descuento 1 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 1 (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={descu1}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setDescu1(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm transition-all duration-200 ${
                  readOnly 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                }`}
              />
            </div>
          </div>

          {/* Descuento 2 */}
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Descuento 2 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={descu2}
                onChange={(e) => {
                  const value = Math.min(Math.max(Number.parseFloat(e.target.value) || 0, 0), 100)
                  setDescu2(value)
                }}
                onFocus={manejarFocoSeleccionCompleta}
                disabled={readOnly}
                className={`w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm transition-all duration-200 ${
                  readOnly 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                }`}
              />
            </div>
            {/* Tooltip descuentos escalonados */}
            <div
              className="relative cursor-pointer mt-5"
              onMouseEnter={() => setMostrarTooltipDescuentos(true)}
              onMouseLeave={() => setMostrarTooltipDescuentos(false)}
            >
              <div className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="w-3.5 h-3.5 text-slate-600"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </div>
              {mostrarTooltipDescuentos && (
                <div className="absolute left-8 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                  Los descuentos se aplican de manera sucesiva sobre el subtotal neto.
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              )}
            </div>
          </div>

                     {/* Resumen de Totales compacto */}
           <div className="col-span-1 flex justify-end items-end">
             <div className="min-w-[420px]">
                                                             <div className="w-full bg-slate-700 rounded-xl shadow border border-slate-600/50 px-6 py-2">
                                   <div className="flex items-center justify-between gap-4 text-sm">
                     <div className="flex items-center gap-1">
                       <span className={`${theme.fuente} font-semibold`}>Subtotal s/IVA:</span>
                       <span className="text-white font-bold text-base">${totales.subtotal?.toFixed(2) ?? "0.00"}</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <span className={`${theme.fuente} font-semibold`}>Subtotal c/Desc:</span>
                       <span className="text-white font-bold text-base">${totales.subtotalConDescuentos?.toFixed(2) ?? "0.00"}</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <span className={`${theme.fuente} font-semibold`}>IVA:</span>
                       <span className="text-white font-bold text-base">${totales.iva?.toFixed(2) ?? "0.00"}</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <span className={`${theme.fuente} font-semibold`}>Total c/IVA:</span>
                       <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-3 py-1 rounded-lg shadow">
                         <span className="font-bold text-base">${totales.total?.toFixed(2) ?? "0.00"}</span>
                       </div>
                     </div>
                   </div>
               </div>
             </div>
           </div>
        </div>
        <div className="w-full">
          <div className="max-h-[20rem] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/50 shadow-lg">
            <table className="items-grid min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-800 to-slate-700 sticky top-0">
                <tr className="bg-slate-700">
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-10">
                    Nro.
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">
                    Código
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-48">
                    Detalle
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-14">
                    Unidad
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-12">
                    Cantidad
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-32">
                    Precio Unitario
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-16">
                    Bonif. %
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">
                    Precio Unit Bonif.
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-20">
                    IVA %
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-24">
                    Total
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-200 uppercase tracking-wider w-10">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const aliPorcRow = aliMap[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0
                  const precioConIVA =
                    row.precioFinal !== "" && row.precioFinal !== undefined
                      ? Number(row.precioFinal)
                      : (row.precio !== "" && row.precio !== undefined
                          ? Number((Number.parseFloat(row.precio) * (1 + aliPorcRow / 100)).toFixed(2))
                          : 0)
                  const bonifParticular = Number.parseFloat(row.bonificacion)
                  const bonifGeneral = Number.parseFloat(bonificacionGeneral) || 0
                  const bonifEfectiva = (Number.isFinite(bonifParticular) && bonifParticular > 0)
                    ? bonifParticular
                    : bonifGeneral
                  const precioBonificado = precioConIVA * (1 - (bonifEfectiva / 100))
                  
                  // Aplicar descuentos globales al precio bonificado
                  let precioConDescuentos = precioBonificado
                  if (descu1 > 0) precioConDescuentos *= (1 - descu1 / 100)
                  if (descu2 > 0) precioConDescuentos *= (1 - descu2 / 100)
                  if (descu3 > 0) precioConDescuentos *= (1 - descu3 / 100)

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors duration-200 hover:bg-slate-50/50 ${
                        isDuplicado(row, idx)
                          ? "bg-gradient-to-r from-red-50 to-red-100/50 border-l-4 border-red-400"
                          : row.esBloqueado
                          ? "bg-blue-50"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={row.codigo}
                          onChange={(e) => handleRowChange(idx, "codigo", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "codigo")}
                          onBlur={() => handleCodigoBlur(idx)}
                          onFocus={manejarFocoSeleccionCompleta}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${
                            row.esBloqueado 
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed" 
                              : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                          }`}
                          placeholder="Código"
                          aria-label="Código producto"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (codigoRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.producto ? (
                          <div className="w-full px-3 py-2 text-slate-700 min-h-[38px] flex items-center">
                            {row.denominacion || ""}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.denominacion}
                            onChange={(e) => handleRowChange(idx, "denominacion", e.target.value)}
                            onFocus={manejarFocoSeleccionCompleta}
                            className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${
                              row.esBloqueado 
                                ? "bg-slate-100 text-slate-500 cursor-not-allowed" 
                                : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                            }`}
                            placeholder="Detalle"
                            aria-label="Detalle ítem genérico"
                            disabled={row.esBloqueado}
                            readOnly={row.esBloqueado}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {row.unidad || "-"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          value={row.cantidad}
                          onChange={(e) => handleCantidadChange(idx, e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "cantidad")}
                          onFocus={manejarFocoSeleccionCompleta}
                          /* Requerir al menos 1 si es ítem de stock o genérico con precio > 0 */
                          min={row.producto || (Number(row.precio) > 0) ? 1 : 0}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${
                            row.esBloqueado 
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed" 
                              : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                          }`}
                          aria-label="Cantidad"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (cantidadRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            row.precioFinal !== "" && row.precioFinal !== undefined
                              ? row.precioFinal
                              : (row.precio !== "" && row.precio !== undefined
                                  ? row.precio
                                  : "")
                          }
                          onChange={(e) => {
                            handleRowChange(idx, "precio", e.target.value)
                          }}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "precio")}
                          onFocus={manejarFocoSeleccionCompleta}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm appearance-none ${
                            row.esBloqueado 
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed" 
                              : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                          }`}
                          style={{
                            MozAppearance: 'textfield'
                          }}
                          aria-label="Precio Unitario"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          placeholder={row.producto ? "" : ""}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={row.bonificacion}
                          onChange={(e) => handleRowChange(idx, "bonificacion", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "bonificacion")}
                          onFocus={manejarFocoSeleccionCompleta}
                          min="0"
                          max="100"
                          step="0.01"
                          className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm transition-all duration-200 shadow-sm ${
                            row.esBloqueado 
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed" 
                              : "bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-slate-400"
                          }`}
                          aria-label="Bonificación particular"
                          tabIndex={row.esBloqueado ? -1 : 0}
                          disabled={row.esBloqueado}
                          readOnly={row.esBloqueado}
                          ref={(el) => (bonificacionRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="w-full px-3 py-2 text-sky-600 min-h-[38px] flex items-center font-semibold">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number(precioBonificado.toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {(() => {
                          const alicuotaId = row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0
                          // CORRECCIÓN: Items bloqueados siempre muestran IVA fijo, no dropdown
                          // Solo items genéricos NO bloqueados muestran el dropdown
                          if (!row.producto && Number(row.precio) > 0 && !row.esBloqueado) {
                            return (
                              <select
                                value={alicuotaId}
                                onChange={(e) => handleIvaChange(idx, Number(e.target.value))}
                                className="px-2 py-1 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              >
                                {[3,4,5,6].filter(id=>aliMap[id]!==undefined).map(id => (
                                  <option key={id} value={id}>{aliMap[id]}%</option>
                                ))}
                              </select>
                            )
                          }
                          // Para items de stock o items bloqueados, mostrar solo el porcentaje fijo
                          const aliPorc = aliMap[alicuotaId] || 0
                          return aliPorc + "%"
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="px-3 py-2 text-emerald-600 font-semibold text-sm">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number((precioConDescuentos * (Number.parseFloat(row.cantidad) || 0)).toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isRowLleno(row) && (
                            <>
                              {row.esBloqueado ? (
                                <div 
                                  className="flex items-center gap-1 text-xs text-blue-600 font-medium cursor-pointer"
                                  onMouseEnter={(e) => handleMouseEnterTooltip(idx, e)}
                                  onMouseLeave={() => handleMouseLeaveTooltip(idx)}
                                >
                                  <span>Original</span>
                                  <div className="w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors duration-200">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth="1.5"
                                      stroke="currentColor"
                                      className="w-2.5 h-2.5 text-blue-600"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                                    </svg>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <BotonDuplicar onClick={() => handleDuplicarRow(idx)} />
                                  <BotonEliminar onClick={() => handleDeleteRow(idx)} />
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
                </div>

        {/* Tooltip flotante global para items originales */}
        {Object.values(mostrarTooltipOriginal).some(Boolean) && (
          <div 
            className="fixed z-[9999] bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-nowrap"
            style={{
              left: `${posicionTooltip.x}px`,
              top: `${posicionTooltip.y}px`, // Debajo del indicador
              transform: 'translateX(-50%)' // Centrado horizontalmente
            }}
          >
            Ítem original de venta - No editable.
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-slate-800"></div>
          </div>
        )}
        
      </div>
    )
  },
)

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />
}

export default ItemsGridPresupuesto;