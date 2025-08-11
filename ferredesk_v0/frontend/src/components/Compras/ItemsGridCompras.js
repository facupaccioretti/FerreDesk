"use client"

import { useState, useEffect, useImperativeHandle, forwardRef, useRef, useMemo } from "react"

function getEmptyRow() {
  return {
    id: Date.now() + Math.random(),
    codigo_proveedor: "",
    producto: null,
    cdi_idsto: null,
    cdi_idpro: null,
    cdi_detalle1: "",
    cdi_detalle2: "",
    cdi_cantidad: 0,
    cdi_costo: 0,
    cdi_idaliiva: 3,
    unidad: "",
  }
}

const ItemsGridCompras = forwardRef(
  (
    {
      items = [],
      productos = [],
      proveedores = [],
      alicuotas = [],
      selectedProveedor = null,
      onItemsChange,
      readOnly = false,
    },
    ref,
  ) => {
    const alicuotasMap = useMemo(
      () => (Array.isArray(alicuotas) ? alicuotas.reduce((acc, a) => ((acc[a.id] = Number(a.porce) || 0), acc), {}) : {}),
      [alicuotas],
    )

    // No precargamos productos - haremos búsqueda directa como en ItemsGrid original

    const toRow = (it) => {
      const producto = it.cdi_idsto ? productos.find((p) => String(p.id) === String(it.cdi_idsto)) : null
      return {
        id: Date.now() + Math.random(),
        codigo_proveedor: it.codigo_proveedor || "",
        producto,
        cdi_idsto: it.cdi_idsto || (producto ? producto.id : null),
        cdi_idpro: it.cdi_idpro || selectedProveedor?.id || null,
        cdi_detalle1: it.cdi_detalle1 || producto?.deno || "",
        cdi_detalle2: it.cdi_detalle2 || producto?.unidad || "",
        cdi_cantidad: Number(it.cdi_cantidad) || 0,
        cdi_costo: Number(it.cdi_costo) || 0,
        cdi_idaliiva:
          it.cdi_idaliiva ?? (typeof producto?.idaliiva === "object" ? producto?.idaliiva?.id : producto?.idaliiva) ?? 3,
        unidad: it.cdi_detalle2 || producto?.unidad || "",
      }
    }

    const [rows, setRows] = useState(() => {
      if (Array.isArray(items) && items.length > 0) {
        let base = items.map(toRow)
        const hasEmpty = base.some((r) => !r.producto && !r.cdi_detalle1)
        if (!hasEmpty) base = [...base, getEmptyRow()]
        return base
      }
      return [getEmptyRow()]
    })

    // ELIMINADO: Este useEffect causaba el re-renderizado que quitaba el foco.
    // El componente ahora manejará su estado internamente después de la carga inicial.

    const isRowLleno = (row) => {
      // Un renglón se considera completo si:
      // 1) Tiene un producto seleccionado (ítem de stock)
      // 2) Es un ítem genérico con descripción no vacía
      return !!(row.producto || (row.cdi_detalle1 && row.cdi_detalle1.trim() !== ""))
    }
    
    const isRowVacio = (row) => {
      return (
        !row.producto &&
        (!row.codigo_proveedor || row.codigo_proveedor.trim() === "") &&
        (!row.cdi_detalle1 || row.cdi_detalle1.trim() === "")
      )
    }

    // Función helper para seleccionar todo el texto al hacer foco en un input (como en ItemsGrid original)
    const manejarFocoSeleccionCompleta = (evento) => {
      // Solo seleccionar si el input no está deshabilitado
      if (!evento.target.disabled && !evento.target.readOnly) {
        evento.target.select()
      }
    }

    const ensureSoloUnEditable = (baseRows) => {
      const result = baseRows.slice()
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

    const emitirCambio = (currentRows) => {
      const itemsCompra = currentRows
        .filter((r) => isRowLleno(r))
        .map((r, idx) => ({
          cdi_orden: idx + 1,
          cdi_idsto: r.producto ? r.producto.id : r.cdi_idsto,
          cdi_idpro: r.cdi_idpro || selectedProveedor?.id || null,
          cdi_cantidad: Number(r.cdi_cantidad) || 0,
          cdi_costo: Number(r.cdi_costo) || 0,
          cdi_detalle1: r.cdi_detalle1 || (r.producto?.deno ?? ""),
          cdi_detalle2: r.cdi_detalle2 || (r.producto?.unidad ?? ""),
          cdi_idaliiva:
            r.cdi_idaliiva ?? (typeof r.producto?.idaliiva === "object" ? r.producto?.idaliiva?.id : r.producto?.idaliiva) ?? 3,
          codigo_proveedor: r.codigo_proveedor || "",
        }))
      onItemsChange?.(itemsCompra)
    }

    // Refs y navegación con Enter
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)
    const [idxCodigoFoco, setIdxCodigoFoco] = useState(null)

    useEffect(() => {
      if (idxCantidadFoco !== null) {
        const el = cantidadRefs.current[idxCantidadFoco]
        if (el) el.focus()
        setIdxCantidadFoco(null)
      }
    }, [idxCantidadFoco])

    useEffect(() => {
      if (idxCodigoFoco !== null) {
        const el = codigoRefs.current[idxCodigoFoco]
        if (el) el.focus()
        setIdxCodigoFoco(null)
      }
    }, [idxCodigoFoco])

    const resolverCodigoProveedor = async (index, codigo) => {
      const provId = selectedProveedor?.id
      if (!codigo || !provId) return false
      try {
        const params = new URLSearchParams({ codigo: String(codigo), proveedor_id: String(provId) })
        const resp = await fetch(`/api/productos/buscar-codigo/?${params.toString()}`, { credentials: "include" })
        if (!resp.ok) return false
        const data = await resp.json()
        const aliPorc = Number(data.alicuota_porcentaje) || 0
        let aliId = 3
        const foundAli = alicuotas.find((a) => Number(a.porce) === aliPorc)
        if (foundAli) aliId = foundAli.id

        setRows((prev) => {
          const nuevo = [...prev]
          const filaActual = { ...nuevo[index] }
          const targetProdId = data.id
          const targetProvId = provId

          // Buscar si ya existe una fila con mismo producto y proveedor (para sumar cantidades)
          const idxExistente = nuevo.findIndex(
            (r, i) => i !== index && (r.producto?.id || r.cdi_idsto) === targetProdId && (r.cdi_idpro || selectedProveedor?.id || null) === targetProvId
          )

          if (idxExistente !== -1) {
            // SUMAR CANTIDADES: Si ya existe el mismo producto/proveedor, sumar cantidad
            const cantidadASumar = Number(filaActual.cdi_cantidad) > 0 ? Number(filaActual.cdi_cantidad) : 1
            const merged = nuevo.map((r, i) =>
              i === idxExistente ? { ...r, cdi_cantidad: (Number(r.cdi_cantidad) || 0) + cantidadASumar } : r,
            )
            // Vaciar solo la fila actual, preservando su id
            merged[index] = { ...getEmptyRow(), id: filaActual.id }
            const ensured = ensureSoloUnEditable(merged)
            emitirCambio(ensured)
            // Mover foco a cantidad de la fila existente
            setIdxCantidadFoco(idxExistente)
            return ensured
          }

          // No existe duplicado: completar la fila actual con los datos del producto
          filaActual.codigo_proveedor = codigo
          filaActual.producto = { id: data.id, deno: data.deno, unidad: data.unidad, idaliiva: aliId, codvta: data.codvta }
          filaActual.cdi_idsto = data.id
          filaActual.cdi_idpro = filaActual.cdi_idpro || targetProvId
          filaActual.cdi_detalle1 = data.deno || ""
          filaActual.cdi_detalle2 = data.unidad || ""
          filaActual.cdi_idaliiva = aliId
          if (!filaActual.cdi_cantidad || filaActual.cdi_cantidad === 0) filaActual.cdi_cantidad = 1
          nuevo[index] = filaActual
          const ensured = ensureSoloUnEditable(nuevo)
          emitirCambio(ensured)
          // Enfocar cantidad de la misma fila tras cargar producto
          setIdxCantidadFoco(index)
          return ensured
        })
        return true
      } catch (e) {
        return false
      }
    }

    const handleRowChange = (idx, field, value) => {
      setRows((prevRows) => {
        const newRows = [...prevRows]
        if (field === "codigo_proveedor") {
          newRows[idx] = {
            ...newRows[idx],
            codigo_proveedor: value,
            ...(value.trim() === ""
              ? {
                  producto: null,
                  cdi_detalle1: "",
                  cdi_detalle2: "",
                  cdi_cantidad: 0,
                  cdi_idsto: null,
                  cdi_idpro: null,
                  cdi_idaliiva: 3,
                }
              : {}),
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          emitirCambio(updatedRows)
          return updatedRows
        } else if (field === "cdi_cantidad") {
          newRows[idx] = {
            ...newRows[idx],
            cdi_cantidad: value,
          }
          const updatedRows = ensureSoloUnEditable(newRows)
          emitirCambio(updatedRows)
          return updatedRows
        }
        return newRows
      })
    }

    const handleRowKeyDown = (e, idx, field) => {
      if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        const row = rows[idx]
        
        if (field === "codigo_proveedor" && row.codigo_proveedor) {
          const provId = selectedProveedor?.id
          if (!provId) return
          
          // Buscar producto por código de proveedor usando el endpoint específico (como en ItemsGrid original)
          const params = new URLSearchParams({ 
            codigo: String(row.codigo_proveedor), 
            proveedor_id: String(provId) 
          })
          
          fetch(`/api/compras/productos/buscar-codigo/?${params.toString()}`, { credentials: "include" })
            .then(resp => {
              if (resp.ok) {
                return resp.json()
              } else {
                throw new Error('Producto no encontrado')
              }
            })
            .then(prod => {
              if (prod) {
                // PRODUCTO ENCONTRADO - replicar lógica exacta del ItemsGrid
                const targetProdId = prod.id
                const targetProvId = provId
                
                // Buscar duplicado (como en ItemsGrid original)
                const idxExistente = rows.findIndex(
                  (r, i) => i !== idx && (r.producto?.id || r.cdi_idsto) === targetProdId && (r.cdi_idpro || selectedProveedor?.id || null) === targetProvId
                )
                
                if (idxExistente !== -1) {
                  // DUPLICADO ENCONTRADO - SUMAR CANTIDADES (modo fijo para compras)
                  const cantidadASumar = Number(row.cdi_cantidad) > 0 ? Number(row.cdi_cantidad) : 1
                  setRows((prevRows) => {
                    const newRows = prevRows.map((r, i) =>
                      i === idxExistente ? { ...r, cdi_cantidad: Number(r.cdi_cantidad) + cantidadASumar } : r,
                    )
                    newRows[idx] = getEmptyRow()
                    const ensured = ensureSoloUnEditable(newRows)
                    emitirCambio(ensured)
                    return ensured
                  })
                  setIdxCantidadFoco(idxExistente)
                  return
                }
                
                // NO ES DUPLICADO - cargar producto en fila actual (como en ItemsGrid original)
                const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
                
                setRows((prevRows) => {
                  const newRows = [...prevRows]
                  
                  const itemCargado = {
                    ...newRows[idx],
                    codigo_proveedor: row.codigo_proveedor,
                    producto: prod,
                    cdi_idsto: prod.id,
                    cdi_idpro: targetProvId,
                    cdi_detalle1: prod.deno || prod.nombre || "",
                    cdi_detalle2: prod.unidad || prod.unidadmedida || "-",
                    cdi_idaliiva: aliId,
                    cdi_cantidad: row.cdi_cantidad || 1,
                  }
                  
                  newRows[idx] = itemCargado
                  if (newRows.every(isRowLleno)) {
                    newRows.push(getEmptyRow())
                  }
                  const ensured = ensureSoloUnEditable(newRows)
                  emitirCambio(ensured)
                  return ensured
                })
                setIdxCantidadFoco(idx)
                return
              } else {
                // PRODUCTO NO ENCONTRADO - limpiar fila (como en ItemsGrid original)
                setRows((prevRows) => {
                  const newRows = [...prevRows]
                  newRows[idx] = { ...getEmptyRow(), id: newRows[idx].id }
                  const ensured = ensureSoloUnEditable(newRows)
                  emitirCambio(ensured)
                  return ensured
                })
                return
              }
            })
            .catch(() => {
              // Error en la petición - limpiar fila
              setRows((prevRows) => {
                const newRows = [...prevRows]
                newRows[idx] = { ...getEmptyRow(), id: newRows[idx].id }
                const ensured = ensureSoloUnEditable(newRows)
                emitirCambio(ensured)
                return ensured
              })
              return
            })
        }
        
        if (field === "cdi_cantidad") {
          // Replicar exactamente la lógica del ItemsGrid original
          if (rows[idx].producto && rows[idx].codigo_proveedor && rows[idx + 1] && isRowVacio(rows[idx + 1])) {
            setTimeout(() => {
              if (codigoRefs.current[idx + 1]) {
                codigoRefs.current[idx + 1].focus()
              }
            }, 0)
          }
        }
      }
    }

    const handleDeleteRow = (idx) => {
      setRows((prev) => {
        const nuevo = prev.filter((_, i) => i !== idx)
        const ensured = ensureSoloUnEditable(nuevo)
        emitirCambio(ensured)
        return ensured
      })
    }

    useImperativeHandle(
      ref,
      () => ({
        getItems: () =>
          rows
            .filter((r) => isRowLleno(r))
            .map((r, idx) => ({
              cdi_orden: idx + 1,
              cdi_idsto: r.producto ? r.producto.id : r.cdi_idsto,
              cdi_idpro: r.cdi_idpro || selectedProveedor?.id || null,
              cdi_cantidad: Number(r.cdi_cantidad) || 0,
              cdi_costo: Number(r.cdi_costo) || 0,
              cdi_detalle1: r.cdi_detalle1 || (r.producto?.deno ?? ""),
              cdi_detalle2: r.cdi_detalle2 || (r.producto?.unidad ?? ""),
              cdi_idaliiva:
                r.cdi_idaliiva ?? (typeof r.producto?.idaliiva === "object" ? r.producto?.idaliiva?.id : r.producto?.idaliiva) ?? 3,
              codigo_proveedor: r.codigo_proveedor || "",
            })),
      }),
      [rows, selectedProveedor?.id, alicuotasMap],
    )

    return (
      <div className="space-y-3 w-full">
        <div className="w-full">
          <div className="max-h-[14rem] overflow-y-auto overscroll-contain rounded-lg border border-slate-200/50 shadow">
            <table className="min-w-full text-[12px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="bg-slate-100">
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-8">Nro.</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-28">Código</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-56">Producto</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-16">Unidad</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-20">Cantidad</th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700 uppercase tracking-wider w-10">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-2 py-1 whitespace-nowrap text-center text-[12px] text-slate-600">{idx + 1}</td>

                    {/* Código proveedor */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      {readOnly ? (
                        <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center">
                          {row.codigo_proveedor || ""}
                        </div>
                      ) : (
                                                                         <input
                          type="text"
                          value={row.codigo_proveedor || ""}
                          onChange={(e) => handleRowChange(idx, "codigo_proveedor", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "codigo_proveedor")}
                          onFocus={manejarFocoSeleccionCompleta}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[12px] bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-all duration-200"
                          placeholder="Código proveedor"
                          ref={(el) => (codigoRefs.current[idx] = el)}
                        />
                      )}
                    </td>

                    {/* Producto (solo lectura) */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center truncate">
                        {row.producto ? `${row.producto.codvta || row.producto.id} - ${row.producto.deno || ""}` : row.cdi_detalle1 || ""}
                      </div>
                    </td>

                    {/* Unidad */}
                    <td className="px-2 py-1 whitespace-nowrap text-[12px] text-slate-600 font-medium">{row.cdi_detalle2 || row.unidad || "-"}</td>

                    {/* Cantidad */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      {readOnly ? (
                        <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center">
                          {row.cdi_cantidad}
                        </div>
                      ) : (
                                                                         <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.cdi_cantidad}
                          onChange={(e) => handleRowChange(idx, "cdi_cantidad", Number(e.target.value) || 0)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, "cdi_cantidad")}
                          onFocus={manejarFocoSeleccionCompleta}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[12px] bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-all duration-200"
                          ref={(el) => (cantidadRefs.current[idx] = el)}
                        />
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-2 py-1 whitespace-nowrap text-center">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="px-1 py-1 text-red-500 hover:text-red-700"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  },
)

export default ItemsGridCompras
