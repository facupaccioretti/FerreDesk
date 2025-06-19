"use client"

import { useState, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react"

// Componente del botón duplicar con estética FerreDesk
const BotonDuplicar = ({ onClick, tabIndex }) => (
  <button
    onClick={onClick}
    className="text-sky-600 hover:text-sky-800 transition-colors duration-200"
    title="Duplicar"
    aria-label="Duplicar fila"
    tabIndex={tabIndex}
    type="button"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
      />
    </svg>
  </button>
)

// Diccionario de alícuotas según la tabla proporcionada
const ALICUOTAS = {
  1: 0, // NO GRAVADO
  2: 0, // EXENTO
  3: 0, // 0%
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
    cantidad: 1,
    precio: "",
    bonificacion: 0,
    producto: null,
  }
}

function normalizeItemsIniciales(itemsIniciales, productosDisponibles = []) {
  if (!Array.isArray(itemsIniciales)) return []
  return itemsIniciales.map((item, idx) => {
    // LOG: item crudo antes de normalizar
    console.debug("[ItemsGrid/normalizeItemsIniciales] Ítem crudo:", { idx, item })
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

    return {
      id: item.id || idx + 1,
      producto: prod,
      codigo: item.codigo || prod?.codvta || prod?.codigo || "",
      denominacion: item.denominacion || prod?.deno || prod?.nombre || "",
      unidad: item.unidad || prod?.unidad || prod?.unidadmedida || "-",
      cantidad: item.cantidad || item.vdi_cantidad || 1,
      precio: (() => {
        const precioDirecto = item.precio ?? item.vdi_importe ?? item.costo ?? 0
        if (precioDirecto && Number(precioDirecto) !== 0) return precioDirecto
        const costo = item.vdi_costo ?? item.costo ?? 0
        return Number.parseFloat(costo) * (1 + Number.parseFloat(margen) / 100)
      })(),
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
    },
    ref,
  ) => {
    const esPresupuesto = modo === "presupuesto"
    const [rows, setRows] = useState(() => {
      if (Array.isArray(initialItems) && initialItems.length > 0) {
        // Detectar si los ítems ya están normalizados (todos tienen 'producto')
        const yaNormalizados = initialItems.every((it) => it.producto)
        return yaNormalizados ? initialItems : normalizeItemsIniciales(initialItems, productosDisponibles)
      }
      return [getEmptyRow()]
    })
    const [stockNegativo, setStockNegativo] = useState(false)
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)

    const getProveedoresProducto = useCallback(
      (productoId, proveedorHabitualId = null) => {
        if (!stockProveedores || !productoId) return []
        const proveedores = stockProveedores[productoId] || []
        let proveedorHabitual = null
        if (proveedorHabitualId) {
          proveedorHabitual = proveedores.find((sp) => sp.proveedor && sp.proveedor.id === proveedorHabitualId)
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
              const nuevoItem = {
                ...lastRow,
                codigo: producto.codvta || producto.codigo || "",
                denominacion: producto.deno || producto.nombre || "",
                unidad: producto.unidad || producto.unidadmedida || "-",
                precio: proveedorInfo?.precio || 0,
                vdi_costo: proveedorInfo?.costo || 0,
                margen: producto?.margen ?? 0,
                cantidad,
                bonificacion: 0,
                producto: producto,
                proveedorId: proveedorId,
              }
              return [...prevRows, nuevoItem, getEmptyRow()]
            })
            return
          }
          return
        }
        setRows((prevRows) => {
          const lastRow = prevRows[prevRows.length - 1]
          const proveedorInfo = getProveedoresProducto(producto.id, proveedorId)[0]
          const nuevoItem = {
            ...lastRow,
            codigo: producto.codvta || producto.codigo || "",
            denominacion: producto.deno || producto.nombre || "",
            unidad: producto.unidad || producto.unidadmedida || "-",
            precio: proveedorInfo?.precio || 0,
            vdi_costo: proveedorInfo?.costo || 0,
            margen: producto?.margen ?? 0,
            cantidad,
            bonificacion: 0,
            producto: producto,
            proveedorId: proveedorId,
          }
          if (!lastRow.producto && !lastRow.codigo) {
            return [...prevRows.slice(0, -1), nuevoItem, getEmptyRow()]
          } else {
            return [...prevRows, nuevoItem, getEmptyRow()]
          }
        })
      },
      [getProveedoresProducto, autoSumarDuplicados],
    )

    useEffect(() => {
      // Si el primer renglón es vacío y el input de código está vacío, enfocar automáticamente
      if (rows.length > 0 && isRowVacio(rows[0]) && (!rows[0].codigo || rows[0].codigo === "")) {
        if (codigoRefs.current[0]) {
          codigoRefs.current[0].focus()
        }
      }
    }, [rows])

    function isRowLleno(row) {
      return !!row.producto
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
          newRows[idx] = {
            ...newRows[idx],
            precio: value,
          }
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
        }
        return newRows
      })
    }

    const handleAddItem = useCallback(
      (producto) => {
        if (!producto) return
        const proveedores = getProveedoresProducto(producto.id)
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
          const items = rows
            .filter((r) => r.producto && (r.codigo || r.producto.id))
            .map((row, idx) => {
              const cantidad = Number.parseFloat(row.cantidad) || 0
              const precio = Number.parseFloat(row.precio) || 0
              const bonif = Number.parseFloat(row.bonificacion) || 0
              const idaliiva =
                row.producto.idaliiva && row.producto.idaliiva.id
                  ? row.producto.idaliiva.id
                  : typeof row.producto.idaliiva === "number"
                    ? row.producto.idaliiva
                    : row.idaliiva || 0
              const margen = row.margen ?? row.vdi_margen ?? row.producto?.margen ?? 0
              const item = {
                vdi_orden: idx + 1,
                vdi_idsto: row.producto.id,
                vdi_idpro: row.proveedorId,
                vdi_cantidad: cantidad,
                vdi_costo: row.vdi_costo ?? 0,
                vdi_margen: margen,
                vdi_bonifica: bonif,
                vdi_detalle1: row.denominacion || "",
                vdi_detalle2: row.unidad || "",
                vdi_idaliiva: idaliiva,
                alicuotaIva: undefined,
                codigo: row.codigo || String(row.producto.id),
                producto: row.producto,
                proveedorId: row.proveedorId,
              }
              return item
            })
          console.log("[ItemsGrid.getItems] Ítems:", items)
          return items
        },
        getRows: () => rows,
        handleAddItem,
        getStockNegativo: () => stockNegativo,
      }),
      [rows, handleAddItem, stockNegativo],
    )

    // Actualizar precio automáticamente al cambiar proveedor
    const handleProveedorChange = (idx, proveedorId) => {
      setRows((prevRows) => {
        const newRows = prevRows.map((row, i) => {
          if (i !== idx) return row
          const productoId = row.producto?.id
          const proveedores = getProveedoresProducto(productoId)
          const proveedor = proveedores.find((p) => String(p.id) === String(proveedorId))
          const nuevoPrecio = proveedor ? proveedor.precio : 0
          return { ...row, proveedorId, precio: nuevoPrecio }
        })
        onRowsChange?.(newRows)
        return newRows
      })
      const row = rows[idx]
      const productoId = row.producto?.id
      const proveedores = getProveedoresProducto(productoId)
      const proveedor = proveedores.find((p) => String(p.id) === String(proveedorId))
      const totalStock = proveedor ? Number(proveedor.stock) : 0
      const totalCantidad = rows.reduce((sum, r, i) => {
        if (r.producto && r.producto.id === productoId && String(r.proveedorId) === String(proveedorId)) {
          return sum + (i === idx ? Number(row.cantidad) : Number(r.cantidad))
        }
        return sum
      }, 0)
      if (totalCantidad > totalStock) {
        setStockNegativo(true)
      } else {
        setStockNegativo(false)
      }
    }

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
      const proveedores = getProveedoresProducto(row.producto?.id)
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
        const newRows = rows.filter((_, i) => i !== idx)
        onRowsChange?.(newRows)
        if (newRows.filter((r) => r.producto && r.codigo).length === 0) {
          return [getEmptyRow()]
        }
        const last = newRows[newRows.length - 1]
        if (last && last.producto) {
          return [...newRows, getEmptyRow()]
        }
        return newRows
      })
    }

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
            const proveedores = getProveedoresProducto(prod.id)
            const proveedorHabitual = proveedores.find((p) => p.esHabitual) || proveedores[0]
            const proveedorId = proveedorHabitual ? proveedorHabitual.id : ""
            const idxExistente = rows.findIndex(
              (r, i) => i !== idx && r.producto && r.producto.id === prod.id && r.proveedorId === proveedorId,
            )
            if (idxExistente !== -1) {
              if (autoSumarDuplicados === "sumar") {
                setRows((rows) => {
                  const newRows = rows.map((r, i) =>
                    i === idxExistente ? { ...r, cantidad: Number(r.cantidad) + Number(row.cantidad) } : r,
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
              const proveedores = getProveedoresProducto(prod.id)
              const proveedorHabitual = proveedores.find((p) => p.esHabitual) || proveedores[0]
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

    // Render con estética FerreDesk
    return (
      <div className="space-y-4 w-full">
        {esPresupuesto && (
          <div className="mb-2 p-4 bg-gradient-to-r from-blue-50 to-blue-100/80 border-l-4 border-blue-500 text-blue-800 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">
                Este es un presupuesto. No se descuenta stock ni se valida disponibilidad. Las validaciones se aplicarán
                al convertir a venta.
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm font-semibold text-slate-700">Bonificación general (%)</label>
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
          </div>
          <span className="ml-4 text-slate-500" tabIndex="0" aria-label="Ayuda bonificación general">
            <svg
              className="inline w-4 h-4 mr-1 text-blue-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4m0-4h.01" />
            </svg>
            <span className="text-xs">La bonificación general solo se aplica a ítems sin bonificación particular.</span>
          </span>
        </div>
        <div className="w-full">
          <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200/50 shadow-lg">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/80 sticky top-0">
                <tr className="bg-slate-100">
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">
                    Nro.
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                    Código
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-48">
                    Denominación
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-20">
                    Unidad
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">
                    Cantidad
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-32">
                    Precio Unitario
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                    Bonif. %
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                    Precio Bonificado
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-20">
                    IVA %
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                    Total
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-20">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const precioConIVA =
                    row.precio !== "" && row.precio !== undefined
                      ? Number(
                          (
                            Number.parseFloat(row.precio) *
                            (1 +
                              (ALICUOTAS[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] ||
                                0) /
                                100)
                          ).toFixed(2),
                        )
                      : 0
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
                        {/* Denominación solo lectura */}
                        <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 text-slate-700 min-h-[38px] flex items-center shadow-sm">
                          {row.denominacion || ""}
                        </div>
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
                          min="1"
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
                            row.precio !== "" && row.precio !== undefined
                              ? Number((parseFloat(row.precio) * (1 + ((ALICUOTAS[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0) / 100))).toFixed(2))
                              : ""
                          }
                          onChange={(e) => {
                            const aliPorc =
                              ALICUOTAS[row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0] || 0
                            const precioBase = Number.parseFloat(e.target.value) / (1 + aliPorc / 100)
                            handleRowChange(idx, "precio", isNaN(precioBase) ? "" : precioBase)
                          }}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "precio")}
                          className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 appearance-none"
                          style={{
                            MozAppearance: 'textfield',
                            minWidth: '100%',
                            width: `${Math.max(String(row.precio !== '' && row.precio !== undefined ? Number((parseFloat(row.precio)*(1+((ALICUOTAS[row.idaliiva??row.producto?.idaliiva?.id??row.producto?.idaliiva??0]||0)/100))).toFixed(2)) : '').length, 10)}ch`,
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
                          {row.producto ? `$${Number(precioBonificado.toFixed(2)).toLocaleString()}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {(() => {
                          const alicuotaId = row.idaliiva ?? row.producto?.idaliiva?.id ?? row.producto?.idaliiva ?? 0
                          const aliPorc = ALICUOTAS[alicuotaId] || 0
                          return aliPorc + "%"
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="px-3 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100/80 rounded-xl border border-emerald-200/50 text-emerald-800 font-bold text-sm shadow-sm">
                          {row.producto
                            ? `$${Number((precioBonificado * (Number.parseFloat(row.cantidad) || 0)).toFixed(2)).toLocaleString()}`                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          {row.producto && (
                            <>
                              <button
                                onClick={() => handleDeleteRow(idx)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-xl transition-all duration-200"
                                title="Eliminar"
                                aria-label="Eliminar fila"
                                tabIndex={0}
                                type="button"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="w-5 h-5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                  />
                                </svg>
                              </button>
                              <div className="hover:bg-orange-50 p-2 rounded-xl transition-all duration-200">
                                <BotonDuplicar
                                  onClick={() => {
                                    setRows((prevRows) => {
                                      const nuevoItem = { ...row, id: Date.now() + Math.random() }
                                      return [...prevRows.slice(0, idx + 1), nuevoItem, ...prevRows.slice(idx + 1)]
                                    })
                                  }}
                                  tabIndex={0}
                                />
                              </div>
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

