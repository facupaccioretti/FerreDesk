"use client"

import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react"
import { TotalesVisualizacion } from "./herramientasforms/useCalculosFormulario"
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
  }
}

function normalizeItemsIniciales(itemsIniciales, productosDisponibles = []) {
  if (!Array.isArray(itemsIniciales)) return []
  return itemsIniciales.map((item, idx) => {
    // Si el ítem ya tiene 'producto', se asume normalizado
    if (item.producto) return { ...item, id: item.id || idx + 1 }
    // Caso contrario, intentar reconstruir usando la lista de productos
    const prod = productosDisponibles.find((p) => p.id === (item.vdi_idsto || item.idSto || item.idsto || item.id))

    // Determinar margen con precedencia correcta
    const margen =
      item.vdi_margen && Number(item.vdi_margen) !== 0
        ? item.vdi_margen
        : item.margen && Number(item.margen) !== 0
          ? item.margen
          : (prod?.margen ?? 0)

    const aliId = (prod?.idaliiva?.id ?? prod?.idaliiva ?? item.vdi_idaliiva ?? 3)
    const aliPorc = ALICUOTAS_POR_DEFECTO[aliId] ?? 0

    const precioFinalBD = item.vdi_precio_unitario_final ?? item.precioFinal ?? null

    const precioBaseCalculado = (() => {
      if (precioFinalBD && Number(precioFinalBD) !== 0) {
        // CORRECCIÓN: Usar división para obtener el precio base desde el precio final
        const divisorIva = 1 + aliPorc / 100
        return divisorIva > 0 ? precioFinalBD / divisorIva : 0
      }
      const precioDirecto = item.precio ?? item.vdi_importe ?? item.costo ?? 0
      if (precioDirecto && Number(precioDirecto) !== 0) return precioDirecto
      const costo = item.vdi_costo ?? item.costo ?? 0
      return Number.parseFloat(costo) * (1 + Number.parseFloat(margen) / 100)
    })()

    return {
      id: item.id || idx + 1,
      producto: prod,
      codigo: item.codigo || prod?.codvta || prod?.codigo || "",
      denominacion: item.denominacion || prod?.deno || prod?.nombre || "",
      unidad: item.unidad || prod?.unidad || prod?.unidadmedida || "-",
      cantidad: item.cantidad || item.vdi_cantidad || 1,
      precio: precioBaseCalculado,
      precioFinal: precioFinalBD || (precioBaseCalculado * (1 + aliPorc / 100)),
      bonificacion: item.bonificacion || item.vdi_bonifica || 0,
      proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || "",
      margen: margen,
      vdi_costo: item.vdi_costo || item.costo || prod?.costo || 0,
      subtotal: item.subtotal || 0,
      idaliiva:
        prod?.idaliiva && typeof prod.idaliiva === "object"
          ? prod.idaliiva.id
          : (prod?.idaliiva ?? item.vdi_idaliiva ?? null),
    }
  })
}

const ItemsGridPresupuesto = forwardRef(
  (
    {
      productosDisponibles,
      proveedores,
      stockProveedores,
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
    },
    ref,
  ) => {
    const esPresupuesto = modo === "presupuesto"
    // Combinar alícuotas del backend con un fallback seguro
    const aliMap = Object.keys(alicuotas || {}).length ? alicuotas : ALICUOTAS_POR_DEFECTO

    const [rows, setRows] = useState(() => {
      if (Array.isArray(initialItems) && initialItems.length > 0) {
        // Detectar si los ítems ya están normalizados (todos tienen 'producto')
        const yaNormalizados = initialItems.every((it) => it.producto)
        let baseRows = yaNormalizados ? initialItems : normalizeItemsIniciales(initialItems, productosDisponibles)

        // Verificar si ya existe un renglón vacío; si no, añadir uno para permitir nuevas cargas
        const hayVacio = baseRows.some(
          (row) => !row.producto && (!row.denominacion || row.denominacion.trim() === ""),
        )
        if (!hayVacio) {
          baseRows = [...baseRows, getEmptyRow()]
        }
        return baseRows
      }
      return [getEmptyRow()]
    })
    const [stockNegativo, setStockNegativo] = useState(false)
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)
    const [mostrarTooltipBonif, setMostrarTooltipBonif] = useState(false)
    const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false)

    // ------------------------------------------------------------
    // Helper: determina el ID de proveedor habitual desde el objeto
    // `producto` recibido. Se cubren los posibles formatos:
    //   • producto.proveedor_habitual  (objeto)
    //   • producto.proveedor_habitual_id (string | número)
    //   • producto.proveedor_habitual  (id numérico directo)
    // ------------------------------------------------------------
    const getProveedorHabitualId = (producto) => {
      if (!producto) return null
      if (producto.proveedor_habitual && typeof producto.proveedor_habitual === 'object') {
        return producto.proveedor_habitual.id
      }
      if (producto.proveedor_habitual_id !== undefined && producto.proveedor_habitual_id !== null) {
        return producto.proveedor_habitual_id
      }
      if (producto.proveedor_habitual !== undefined && producto.proveedor_habitual !== null) {
        return producto.proveedor_habitual
      }
      return null
    }

    const getProveedoresProducto = useCallback(
      (productoId, proveedorHabitualId = null) => {
        if (!stockProveedores || !productoId) return []
        const proveedores = stockProveedores[productoId] || []
        let proveedorHabitual = null
        if (proveedorHabitualId !== null && proveedorHabitualId !== undefined && proveedorHabitualId !== '') {
          proveedorHabitual = proveedores.find(
            (sp) => sp.proveedor && String(sp.proveedor.id) === String(proveedorHabitualId),
          )
        }
        if (!proveedorHabitual) {
          proveedorHabitual =
            proveedores.find((sp) => !!(sp.proveedor_habitual || sp.habitual || sp.es_habitual)) || proveedores[0]
        }
        if (!proveedorHabitual) return []
        return [
          {
            id: proveedorHabitual.proveedor.id,
            nombre: proveedorHabitual.proveedor.razon,
            stock: proveedorHabitual.cantidad,
            precio: proveedorHabitual.precio_venta,
            costo:
              Number.parseFloat(proveedorHabitual.costo) || Number.parseFloat(proveedorHabitual.precio_compra) || 0,
            esHabitual: true,
          },
        ]
      },
      [stockProveedores],
    )

    const addItemWithDuplicado = useCallback(
      (producto, proveedorId, cantidad = 1) => {
        const idxExistente = rows.findIndex((r) => r.producto && r.producto.id === producto.id)
        if (idxExistente !== -1) {
          if (autoSumarDuplicados === "sumar") {
            setRows((rows) =>
              rows.map((row, i) => (i === idxExistente ? { ...row, cantidad: Number(row.cantidad) + cantidad } : row)),
            )
            return
          }
          if (autoSumarDuplicados === "eliminar") {
            setRows((rows) => rows.filter((_, i) => i !== idxExistente))
            return
          }
          if (autoSumarDuplicados === "duplicar") {
            setRows((prevRows) => {
              const lastRow = prevRows[prevRows.length - 1]
              const proveedorInfo = getProveedoresProducto(producto.id, proveedorId)[0]

              // -------------------------------------------------------------
              // Cálculo del precio base (sin IVA) y precio final (con IVA)
              // 1) Si el backend ya provee un precio de venta, usarlo.
              // 2) Caso contrario, generar precio = costo * (1 + margen/100).
              // 3) Luego aplicar IVA según la alícuota para obtener precioFinal.
              // -------------------------------------------------------------
              const margenNum = Number.parseFloat(producto?.margen ?? 0) || 0
              const costoNum = Number.parseFloat(proveedorInfo?.costo ?? 0) || 0
              const aliIdTmp = typeof producto.idaliiva === 'object' ? producto.idaliiva.id : (producto.idaliiva ?? 3)
              const aliPorcTmp = aliMap[aliIdTmp] || 0

              let precioBaseTmp = Number.parseFloat(proveedorInfo?.precio ?? 0) || 0
              if (!precioBaseTmp) {
                precioBaseTmp = costoNum * (1 + margenNum / 100)
              }
              // Redondear a 2 decimales
              precioBaseTmp = Math.round(precioBaseTmp * 100) / 100
              const precioFinalTmp = Math.round((precioBaseTmp * (1 + aliPorcTmp / 100)) * 100) / 100

              const nuevoItem = {
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
                proveedorId: proveedorId,
              }
              return [...prevRows.slice(0, idxExistente), nuevoItem, ...prevRows.slice(idxExistente)]
            })
            return
          }
          return
        }
        setRows((prevRows) => {
          const lastRow = prevRows[prevRows.length - 1]
          const proveedorInfo = getProveedoresProducto(producto.id, proveedorId)[0]

          // --- Cálculo precio base / final (idéntico al bloque anterior) ---
          const margenTmp = Number.parseFloat(producto?.margen ?? 0) || 0
          const costoTmp = Number.parseFloat(proveedorInfo?.costo ?? 0) || 0
          const aliIdTmp = typeof producto.idaliiva === 'object' ? producto.idaliiva.id : (producto.idaliiva ?? 3)
          const aliPorcTmp = aliMap[aliIdTmp] || 0

          let precioBaseTmp = Number.parseFloat(proveedorInfo?.precio ?? 0) || 0
          if (!precioBaseTmp) {
            precioBaseTmp = costoTmp * (1 + margenTmp / 100)
          }
          precioBaseTmp = Math.round(precioBaseTmp * 100) / 100
          const precioFinalTmp = Math.round((precioBaseTmp * (1 + aliPorcTmp / 100)) * 100) / 100

          const nuevoItem = {
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
            proveedorId: proveedorId,
          }
          if (!lastRow.producto && !lastRow.codigo) {
            return [...prevRows.slice(0, -1), nuevoItem, getEmptyRow()]
          } else {
            return [...prevRows, nuevoItem, getEmptyRow()]
          }
        })
      },
      [getProveedoresProducto, autoSumarDuplicados, stockProveedores, modo],
    )

    // Log de llegada/actualización de stockProveedores
    useEffect(() => {}, [stockProveedores, modo])

    useEffect(() => {
      // Si el primer renglón es vacío y el input de código está vacío, enfocar automáticamente
      if (rows.length > 0 && isRowVacio(rows[0]) && (!rows[0].codigo || rows[0].codigo === "")) {
        if (codigoRefs.current[0]) {
          codigoRefs.current[0].focus()
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
      // Solo agrego un vacío si todos los renglones tienen producto
      result.push({ ...getEmptyRow(), id: Date.now() + Math.random() })
      return result
    }

    const handleRowChange = (idx, field, value) => {
      setRows((prevRows) => {
        const newRows = [...prevRows]
        if (field === "codigo") {
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
                  proveedorId: "",
                }
              : {}),
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          onRowsChange?.(updatedRows)
          return updatedRows
        } else if (field === "precio") {
          const userInput = value
          const fila = { ...newRows[idx] }
          const esGenerico = !fila.producto

          let aliFinalId = fila.idaliiva ?? 3
          // Autoseleccionar IVA 21% para genéricos si se ingresa un precio
          if (esGenerico && Number(userInput) > 0 && (aliFinalId === 3 || aliFinalId === 0)) {
            aliFinalId = 5 // ID para 21%
          } else if (esGenerico && (userInput === "" || Number(userInput) === 0)) {
            aliFinalId = 3 // ID para 0%
          }

          const aliFinalPorc = aliMap[aliFinalId] || 0
          const userInputNum = Number.parseFloat(userInput) || 0

          // ----------------- CORRECCIÓN DE FÓRMULA -----------------
          // Si el usuario ingresa un precio FINAL (con IVA), para obtener
          // el precio base sin IVA debemos DIVIDIR por (1 + IVA/100)
          const divisorIVA = 1 + (aliFinalPorc / 100)
          const precioBase = divisorIVA !== 0 ? (userInputNum / divisorIVA) : 0
          // ---------------------------------------------------------

          if (esGenerico) {
            // Ítem genérico: el precio base pasa a ser también el costo.
            fila.vdi_costo = Number.isFinite(precioBase) ? precioBase : 0
            fila.margen = 0
          } else {
            // Ítem de stock: el costo permanece fijo; recalculamos margen.
            const costo = Number.parseFloat(fila.vdi_costo ?? fila.producto?.costo ?? 0)
            if (costo > 0) {
              const margenNuevo = ((precioBase - costo) / costo) * 100
              fila.margen = Number.isFinite(margenNuevo) ? Number(margenNuevo.toFixed(2)) : 0
            } else {
              fila.margen = 0
            }
          }

          fila.precioFinal = userInputNum
          // Guardar precio base con 4 decimales para evitar errores de redondeo
          fila.precio = Number.isFinite(precioBase) ? Number(precioBase.toFixed(4)) : ""
          fila.idaliiva = aliFinalId

          newRows[idx] = fila
          const updatedRows = ensureSoloUnEditable(newRows)
          onRowsChange?.(updatedRows)
          return updatedRows
        } else if (field === "bonificacion") {
          newRows[idx] = {
            ...newRows[idx],
            [field]: value,
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          onRowsChange?.(updatedRows)
          return updatedRows
        } else if (field === "denominacion") {
          newRows[idx] = {
            ...newRows[idx],
            denominacion: value,
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          onRowsChange?.(updatedRows)
          return updatedRows
        }
        return newRows
      })
    }

    const handleAddItem = useCallback(
      (producto) => {
        if (!producto) return
        const proveedorHabitualId = getProveedorHabitualId(producto)
        const proveedores = getProveedoresProducto(producto.id, proveedorHabitualId)
        const proveedor = proveedores[0] // Siempre será el proveedor habitual
        const proveedorId = proveedor ? proveedor.id : ""
        const cantidad = 1
        const totalStock = proveedor ? Number(proveedor.stock) : 0
        if (cantidad > totalStock) {
          setStockNegativo(true)
          return
        }
        addItemWithDuplicado(producto, proveedorId, cantidad)
      },
      [addItemWithDuplicado, getProveedoresProducto, setStockNegativo],
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

              if (row.producto) {
                // --- LÓGICA PARA ÍTEM DE STOCK ---
                const idaliiva = row.producto.idaliiva?.id ?? row.producto.idaliiva ?? row.idaliiva ?? 3;
                const margen = row.margen ?? row.vdi_margen ?? row.producto.margen ?? 0;
                
                return {
                  vdi_orden: idx + 1,
                  vdi_idsto: row.producto.id,
                  vdi_idpro: row.proveedorId,
                  vdi_cantidad: cantidad,
                  vdi_costo: row.vdi_costo ?? 0,
                  vdi_margen: margen,
                  vdi_bonifica: bonif,
                  vdi_precio_unitario_final: row.precioFinal || null,
                  vdi_detalle1: row.denominacion || "",
                  vdi_detalle2: row.unidad || "",
                  vdi_idaliiva: idaliiva,
                  codigo: row.codigo || String(row.producto.id),
                  producto: row.producto,
                  proveedorId: row.proveedorId,
                };
              } else {
                // --- LÓGICA PARA ÍTEM GENÉRICO ---
                return {
                  vdi_orden: idx + 1,
                  vdi_idsto: null,
                  vdi_idpro: null,
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
      const proveedorHabitualId = getProveedorHabitualId(row.producto)
      const proveedores = getProveedoresProducto(row.producto?.id, proveedorHabitualId)
      const proveedor = proveedores[0] // Siempre será el proveedor habitual
      const totalStock = proveedor ? Number(proveedor.stock) : 0
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

    // Eliminar ítem y dejar solo un renglón vacío si no quedan ítems
    const handleDeleteRow = (idx) => {
      setRows((rows) => {
        const newRows = rows.filter((_, i) => i !== idx);
        onRowsChange?.(newRows);

        // Si después de eliminar, no queda ninguna fila "llena" (ni de stock ni genérica),
        // entonces reiniciamos la grilla a un único renglón vacío.
        if (newRows.every(row => !isRowLleno(row))) {
          return [getEmptyRow()];
        }

        // Si la última fila está llena, nos aseguramos de que haya una vacía debajo.
        const last = newRows[newRows.length - 1];
        if (last && isRowLleno(last)) {
          return [...newRows, getEmptyRow()];
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
        onRowsChange?.(newRows);
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
    const handleRowKeyDown = (e, idx, field) => {
      if (e.key === "Enter" || (e.key === "Tab" && field === "bonificacion")) {
        const row = rows[idx]
        if (field === "codigo" && row.codigo) {
          const prod = productosDisponibles.find(
            (p) => (p.codvta || p.codigo)?.toString().toLowerCase() === row.codigo.toLowerCase(),
          )
          if (prod) {
            const proveedorHabitualId = getProveedorHabitualId(prod)
            const proveedores = getProveedoresProducto(prod.id, proveedorHabitualId)
            const proveedorHabitual = proveedores.find((p) => p.esHabitual) || proveedores[0]
            const proveedorId = proveedorHabitual ? proveedorHabitual.id : ""
            const idxExistente = rows.findIndex(
              (r, i) => i !== idx && r.producto && r.producto.id === prod.id && r.proveedorId === proveedorId,
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
                  newRows[idx] = {
                    ...newRows[idx],
                    codigo: prod.codvta || prod.codigo || "",
                    denominacion: prod.deno || prod.nombre || "",
                    unidad: prod.unidad || prod.unidadmedida || "-",
                    precio: proveedorHabitual?.precio || 0,
                    vdi_costo: proveedorHabitual?.costo || 0,
                    margen: prod?.margen ?? 0,
                    cantidad: row.cantidad || 1,
                    bonificacion: 0,
                    producto: prod,
                    idaliiva: typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3),
                    proveedorId: proveedorId,
                  }
                  if (newRows.every(isRowLleno)) {
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
              const precioBase = proveedorHabitual?.precio || 0
              const precioFinal = Math.round(precioBase * (1 + aliPorc / 100) * 100) / 100
              newRows[idx] = {
                ...newRows[idx],
                codigo: prod.codvta || prod.codigo || "",
                denominacion: prod.deno || prod.nombre || "",
                unidad: prod.unidad || prod.unidadmedida || "-",
                precio: precioBase,
                precioFinal: precioFinal,
                vdi_costo: proveedorHabitual?.costo || 0,
                margen: prod?.margen ?? 0,
                cantidad: row.cantidad || 1,
                bonificacion: 0,
                producto: prod,
                idaliiva: aliId,
                proveedorId: proveedorHabitual ? proveedorHabitual.id : "",
              }
              if (newRows.every(isRowLleno)) {
                newRows.push(getEmptyRow())
              }
              return ensureSoloUnEditable(newRows)
            })
            setIdxCantidadFoco(idx)
            e.preventDefault()
            e.stopPropagation()
            return
          } else {
            setRows((prevRows) => {
              const newRows = [...prevRows]
              newRows[idx] = { ...getEmptyRow(), id: newRows[idx].id }
              return ensureSoloUnEditable(newRows)
            })
            e.preventDefault()
            e.stopPropagation()
            return
          }
        }
        if (field === "cantidad") {
          if (rows[idx].producto && rows[idx].codigo && rows[idx + 1] && isRowVacio(rows[idx + 1])) {
            setTimeout(() => {
              if (codigoRefs.current[idx + 1]) codigoRefs.current[idx + 1].focus()
            }, 0)
          }
        }
      }
      if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
      }
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

    // Notificar al padre cuando cambian los rows
    useEffect(() => {
      if (onRowsChange) {
        onRowsChange(rows)
      }
    }, [rows, onRowsChange])

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
                className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
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
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
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
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
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
              <div className="w-full bg-gradient-to-r from-slate-50 via-slate-100/80 to-slate-50 rounded-xl shadow border border-slate-300/50 px-6 py-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-semibold">Subtotal s/IVA:</span>
                    <span className="text-slate-800 font-bold text-base">${totales.subtotal?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-semibold">Subtotal c/Desc:</span>
                    <span className="text-slate-800 font-bold text-base">${totales.subtotalConDescuentos?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-semibold">IVA:</span>
                    <span className="text-slate-800 font-bold text-base">${totales.iva?.toFixed(2) ?? "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 font-semibold">Total c/IVA:</span>
                    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-3 py-1 rounded-lg shadow">
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
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/80 sticky top-0">
                <tr className="bg-slate-100">
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-10">
                    Nro.
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-14">
                    Código
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-48">
                    Detalle
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-14">
                    Unidad
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-12">
                    Cantidad
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-32">
                    Precio Unitario
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-24">
                    Bonif. %
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-24">
                    Precio Unit Bonif.
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-20">
                    IVA %
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-24">
                    Total
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wider w-10">
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
                  const precioBonificado = precioConIVA * (1 - (Number.parseFloat(row.bonificacion) || 0) / 100)

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors duration-200 hover:bg-slate-50/50 ${
                        isDuplicado(row, idx)
                          ? "bg-gradient-to-r from-red-50 to-red-100/50 border-l-4 border-red-400"
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                          placeholder="Código"
                          aria-label="Código producto"
                          tabIndex={0}
                          ref={(el) => (codigoRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.producto ? (
                          <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 text-slate-700 min-h-[38px] flex items-center shadow-sm">
                            {row.denominacion || ""}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.denominacion}
                            onChange={(e) => handleRowChange(idx, "denominacion", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                            placeholder="Detalle"
                            aria-label="Detalle ítem genérico"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {row.unidad || "-"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={row.cantidad}
                          onChange={(e) => handleCantidadChange(idx, e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "cantidad")}
                          /* Requerir al menos 1 si es ítem de stock o genérico con precio > 0 */
                          min={row.producto || (Number(row.precio) > 0) ? 1 : 0}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                          aria-label="Cantidad"
                          tabIndex={0}
                          ref={(el) => (cantidadRefs.current[idx] = el)}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={
                            row.precioFinal !== "" && row.precioFinal !== undefined
                              ? Number(row.precioFinal)
                              : (row.precio !== "" && row.precio !== undefined
                                  ? Math.round((parseFloat(row.precio) * (1 + (aliMap[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0) / 100)) * 100) / 100
                                  : "")
                          }
                          onChange={(e) => {
                            handleRowChange(idx, "precio", e.target.value)
                          }}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "precio")}
                          className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 appearance-none"
                          style={{
                            MozAppearance: 'textfield',
                            width: `${Math.max(String((row.precioFinal !== '' && row.precioFinal !== undefined ? row.precioFinal : (row.precio !== '' && row.precio !== undefined ? (Math.round((parseFloat(row.precio) * (1 + (aliMap[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0) / 100)) * 100) / 100) : ''))).toString().length, 10)}ch`,
                          }}
                          aria-label="Precio Unitario"
                          tabIndex={0}
                          placeholder={row.producto ? "" : ""}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="number"
                          value={row.bonificacion}
                          onChange={(e) => handleRowChange(idx, "bonificacion", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "bonificacion")}
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                          aria-label="Bonificación particular"
                          tabIndex={0}
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 text-slate-700 min-h-[38px] flex items-center shadow-sm font-medium">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number(precioBonificado.toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {(() => {
                          const alicuotaId = row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0
                          if (!row.producto && Number(row.precio) > 0) {
                            return (
                              <select
                                value={alicuotaId}
                                onChange={(e) => handleIvaChange(idx, Number(e.target.value))}
                                className="px-2 py-1 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              >
                                {[3,4,5,6].filter(id=>aliMap[id]!==undefined).map(id => (
                                  <option key={id} value={id}>{aliMap[id]}%</option>
                                ))}
                              </select>
                            )
                          }
                          const aliPorc = aliMap[alicuotaId] || 0
                          return aliPorc + "%"
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="px-3 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100/80 rounded-xl border border-emerald-200/50 text-emerald-800 font-bold text-sm shadow-sm">
                          {(row.producto || (row.denominacion && row.denominacion.trim() !== ""))
                            ? `$${Number((precioBonificado * (Number.parseFloat(row.cantidad) || 0)).toFixed(2)).toLocaleString()}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isRowLleno(row) && (
                            <>
                              <BotonDuplicar onClick={() => handleDuplicarRow(idx)} />
                              <BotonEliminar onClick={() => handleDeleteRow(idx)} />
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
      </div>
    )
  },
)

export function ItemsGridVenta(props, ref) {
  return <ItemsGridPresupuesto {...props} ref={ref} />
}

export default ItemsGridPresupuesto;