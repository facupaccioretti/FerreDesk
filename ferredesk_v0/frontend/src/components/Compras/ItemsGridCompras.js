"use client"

import { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from "react"

function getEmptyRow(modoOrdenCompra = false) {
  if (modoOrdenCompra) {
    return {
      id: Date.now() + Math.random(),
      codigo_venta: "",
      producto: null,
      odi_idsto: null,
      odi_idpro: null,
      odi_detalle1: "",
      odi_detalle2: "",
      odi_cantidad: 0,
      odi_stock_proveedor: null,
      unidad: "",
    }
  } else {
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
}

const ItemsGridCompras = forwardRef(
  (
    {
      items = [],
      initialItems = [], // NUEVO: prop para items iniciales
      productos = [],
      proveedores = [],
      alicuotas = [],
      selectedProveedor = null,
      onItemsChange,
      readOnly = false,
      modoOrdenCompra = false, // Nuevo prop para modo ordenes de compra
      mostrarModoLector = false, // Muestra checkbox "Modo lector" solo en Orden de Compra
    },
    ref,
  ) => {
    

    // No precargamos productos - haremos búsqueda directa como en ItemsGrid original

    const toRow = useCallback((it) => {
      // Si el item ya tiene un producto completo (viene del buscador), usarlo directamente
      const producto = it.producto || (it.cdi_idsto ? productos.find((p) => String(p.id) === String(it.cdi_idsto)) : null)
      
      if (modoOrdenCompra) {
        // Campos para Orden de Compra (modelo OrdenCompraDetalleItem)
        return {
          id: it.id || Date.now() + Math.random(),
          codigo_venta: it.codigo_venta || producto?.codvta || "",
          producto,
          odi_idsto: it.odi_idsto || (producto ? producto.id : null),
          odi_idpro: it.odi_idpro || selectedProveedor?.id || null,
          odi_detalle1: it.odi_detalle1 || producto?.deno || "",
          odi_detalle2: it.odi_detalle2 || producto?.unidad || "",
          odi_cantidad: Number(it.odi_cantidad) || 0,
          odi_stock_proveedor: it.odi_stock_proveedor || null,
          unidad: it.odi_detalle2 || producto?.unidad || "",
        }
      } else {
        // Campos para Compra normal (modelo CompraDetalleItem)
        // NUEVO: Priorizar campos que ya vienen completos en el item (para conversiones)
        return {
          id: it.id || Date.now() + Math.random(),
          codigo_proveedor: it.codigo_proveedor || producto?.codigo_proveedor || "",
          producto,
          cdi_idsto: it.cdi_idsto || (producto ? producto.id : null),
          cdi_idpro: it.cdi_idpro || selectedProveedor?.id || null,
          // Priorizar campos del item sobre campos del producto (para conversiones)
          cdi_detalle1: it.cdi_detalle1 || producto?.deno || "",
          cdi_detalle2: it.cdi_detalle2 || producto?.unidad || "",
          cdi_cantidad: Number(it.cdi_cantidad) || 0,
          cdi_costo: Number(it.cdi_costo) || 0,
          cdi_idaliiva:
            it.cdi_idaliiva ?? (typeof producto?.idaliiva === "object" ? producto?.idaliiva?.id : producto?.idaliiva) ?? 3,
          unidad: it.cdi_detalle2 || producto?.unidad || it.unidad || "",
        }
      }
    }, [productos, selectedProveedor?.id, modoOrdenCompra])

    const [rows, setRows] = useState(() => {
      // Priorizar initialItems para la carga inicial, luego items para actualizaciones
      const itemsToProcess = Array.isArray(initialItems) && initialItems.length > 0 
        ? initialItems 
        : items;
      
      if (Array.isArray(itemsToProcess) && itemsToProcess.length > 0) {
        let base = itemsToProcess.map(toRow)
        const hasEmpty = base.some((r) => !r.producto && !r.cdi_detalle1)
        if (!hasEmpty) base = [...base, getEmptyRow(modoOrdenCompra)]
        return base
      }
      return [getEmptyRow(modoOrdenCompra)]
    })


    // Función helper para obtener el campo correcto según el modo
    const getField = useCallback((row, fieldName) => {
      if (modoOrdenCompra) {
        const odiField = fieldName.replace('cdi_', 'odi_')
        return row[odiField] || row[fieldName] || ""
      }
      return row[fieldName] || ""
    }, [modoOrdenCompra])

    const isRowLleno = useCallback((row) => {
      // Un renglón se considera completo si:
      // 1) Tiene un producto seleccionado (ítem de stock)
      // 2) Es un ítem genérico con descripción no vacía
      const detalle1 = getField(row, 'cdi_detalle1')
      return !!(row.producto || (detalle1 && detalle1.trim() !== ""))
    }, [getField])
    
    const isRowVacio = useCallback((row) => {
      const codigoVacio = modoOrdenCompra 
        ? (!row.codigo_venta || row.codigo_venta.trim() === "")
        : (!row.codigo_proveedor || row.codigo_proveedor.trim() === "")
      
      const detalle1 = getField(row, 'cdi_detalle1')
      return (
        !row.producto &&
        codigoVacio &&
        (!detalle1 || detalle1.trim() === "")
      )
    }, [modoOrdenCompra, getField])

    // Función helper para seleccionar todo el texto al hacer foco en un input (como en ItemsGrid original)
    const manejarFocoSeleccionCompleta = (evento) => {
      // Solo seleccionar si el input no está deshabilitado
      if (!evento.target.disabled && !evento.target.readOnly) {
        evento.target.select()
      }
    }

    const ensureSoloUnEditable = useCallback((baseRows) => {
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
      result.push({ ...getEmptyRow(modoOrdenCompra), id: Date.now() + Math.random() })
      return result
    }, [isRowLleno, isRowVacio, modoOrdenCompra])

    const emitirCambio = useCallback((currentRows) => {
      // Asegurar que siempre haya un proveedor seleccionado
      if (!selectedProveedor?.id) {
        console.error("No hay proveedor seleccionado")
        return
      }

      const itemsCompra = currentRows
        .filter((r) => isRowLleno(r))
        .map((r, idx) => {
          if (modoOrdenCompra) {
            // Campos para Orden de Compra (odi_*)
            return {
              odi_orden: idx + 1,
              odi_idsto: r.producto ? r.producto.id : r.odi_idsto,
              odi_idpro: selectedProveedor.id,
              odi_cantidad: Number(r.odi_cantidad) || 0,
              odi_detalle1: r.odi_detalle1 || (r.producto?.deno ?? ""),
              odi_detalle2: r.odi_detalle2 || (r.producto?.unidad ?? ""),
              odi_stock_proveedor: r.odi_stock_proveedor || null,
            }
          } else {
            // Campos para Compra (cdi_*)
            return {
              cdi_orden: idx + 1,
              cdi_idsto: r.producto ? r.producto.id : r.cdi_idsto,
              cdi_idpro: selectedProveedor.id,
              cdi_cantidad: Number(r.cdi_cantidad) || 0,
              cdi_costo: Number(r.cdi_costo) || 0,
              cdi_detalle1: r.cdi_detalle1 || (r.producto?.deno ?? ""),
              cdi_detalle2: r.cdi_detalle2 || (r.producto?.unidad ?? ""),
              cdi_idaliiva:
                r.cdi_idaliiva ?? (typeof r.producto?.idaliiva === "object" ? r.producto?.idaliiva?.id : r.producto?.idaliiva) ?? 3,
              codigo_proveedor: r.codigo_proveedor || "",
            }
          }
        })
      
      // Usar setTimeout para evitar el warning de setState durante renderizado
      setTimeout(() => {
        onItemsChange?.(itemsCompra)
      }, 0)
    }, [selectedProveedor?.id, isRowLleno, onItemsChange, modoOrdenCompra])

    // Refs y navegación con Enter
    const codigoRefs = useRef([])
    const cantidadRefs = useRef([])
    const [idxCantidadFoco, setIdxCantidadFoco] = useState(null)
    const [idxCodigoFoco, setIdxCodigoFoco] = useState(null)
    const [modoLector, setModoLector] = useState(false)
    const [idxCodigoSiguienteFoco, setIdxCodigoSiguienteFoco] = useState(null)

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

    // useEffect para modo lector: mover foco al código del siguiente renglón vacío
    useEffect(() => {
      if (idxCodigoSiguienteFoco !== null) {
        const idxRenglonVacio = rows.findIndex((row, i) => i > idxCodigoSiguienteFoco && isRowVacio(row))
        if (idxRenglonVacio !== -1 && codigoRefs.current[idxRenglonVacio]) {
          codigoRefs.current[idxRenglonVacio].focus()
        }
        setIdxCodigoSiguienteFoco(null)
      }
    }, [rows, idxCodigoSiguienteFoco, isRowVacio])

    

    const handleRowChange = (idx, field, value) => {
      setRows((prevRows) => {
        const newRows = [...prevRows]
        if (field === "codigo_proveedor" || field === "codigo_venta") {
          const codigoField = modoOrdenCompra ? "codigo_venta" : "codigo_proveedor"
          newRows[idx] = {
            ...newRows[idx],
            [codigoField]: value,
            ...(value.trim() === ""
              ? modoOrdenCompra 
                ? {
                    producto: null,
                    odi_detalle1: "",
                    odi_detalle2: "",
                    odi_cantidad: 0,
                    odi_idsto: null,
                    odi_idpro: null,
                    odi_stock_proveedor: null,
                  }
                : {
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
        } else if (field === "odi_cantidad") {
          newRows[idx] = {
            ...newRows[idx],
            odi_cantidad: value,
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
        
        if ((field === "codigo_proveedor" && row.codigo_proveedor) || (field === "codigo_venta" && row.codigo_venta)) {
          const provId = selectedProveedor?.id
          if (!provId) return
          
          const codigo = modoOrdenCompra ? row.codigo_venta : row.codigo_proveedor
          
          // Buscar producto por código de venta o proveedor según el modo
          const endpoint = modoOrdenCompra 
            ? `/api/compras/proveedores/${provId}/productos/?codigo_venta=${encodeURIComponent(codigo)}`
            : `/api/compras/productos/buscar-codigo/?codigo=${encodeURIComponent(codigo)}&proveedor_id=${provId}`
          
          fetch(endpoint, { credentials: "include" })
            .then(resp => {
              if (resp.ok) {
                return resp.json()
              } else {
                throw new Error('Producto no encontrado')
              }
            })
                        .then(data => {
              // El endpoint puede devolver un array o un objeto único
              const productos = Array.isArray(data) ? data : [data]
              const prod = productos.length > 0 ? productos[0] : null
              
              // Verificar que el producto tenga los campos necesarios
              if (prod && prod.id && (prod.deno || prod.nombre)) {
                // PRODUCTO ENCONTRADO - replicar lógica exacta del ItemsGrid
                const targetProdId = prod.id
                const targetProvId = provId
                
                // Buscar duplicado (como en ItemsGrid original)
                const idxExistente = rows.findIndex(
                  (r, i) => {
                    if (i === idx) return false // No comparar con la fila actual
                    
                    // Verificar si el producto ya existe en otra fila
                    const productoExistente = r.producto?.id || (modoOrdenCompra ? r.odi_idsto : r.cdi_idsto)
                    const proveedorExistente = (modoOrdenCompra ? r.odi_idpro : r.cdi_idpro) || selectedProveedor?.id || null
                    
                    return productoExistente === targetProdId && proveedorExistente === targetProvId
                  }
                )
                
                if (idxExistente !== -1) {
                  // DUPLICADO ENCONTRADO - SUMAR CANTIDADES según el modo
                  const cantidadASumar = modoOrdenCompra 
                    ? (Number(row.odi_cantidad) > 0 ? Number(row.odi_cantidad) : 1)
                    : (Number(row.cdi_cantidad) > 0 ? Number(row.cdi_cantidad) : 1)
                  
                  setRows((prevRows) => {
                    const newRows = prevRows.map((r, i) => {
                      if (i === idxExistente) {
                        if (modoOrdenCompra) {
                          return { ...r, odi_cantidad: Number(r.odi_cantidad) + cantidadASumar }
                        } else {
                          return { ...r, cdi_cantidad: Number(r.cdi_cantidad) + cantidadASumar }
                        }
                      }
                      return r
                    })
                    newRows[idx] = getEmptyRow(modoOrdenCompra)
                    const ensured = ensureSoloUnEditable(newRows)
                    emitirCambio(ensured)
                    return ensured
                  })
                  if (modoLector) {
                    setIdxCodigoSiguienteFoco(idxExistente)
                  } else {
                    setIdxCantidadFoco(idxExistente)
                  }
                  return
                }
                
                // NO ES DUPLICADO - cargar producto en fila actual según el modo
                setRows((prevRows) => {
                  const newRows = [...prevRows]
                  
                  if (modoOrdenCompra) {
                    // Campos para Orden de Compra
                    const itemCargado = {
                      ...newRows[idx],
                      codigo_venta: row.codigo_venta,
                      producto: prod,
                      odi_idsto: prod.id,
                      odi_idpro: targetProvId,
                      odi_detalle1: prod.deno || prod.nombre || "",
                      odi_detalle2: prod.unidad || prod.unidadmedida || "-",
                      odi_cantidad: row.odi_cantidad || 1,
                      odi_stock_proveedor: prod.stockprove_id || null,
                    }
                    newRows[idx] = itemCargado
                  } else {
                    // Campos para Compra normal
                    const aliId = typeof prod.idaliiva === 'object' ? prod.idaliiva.id : (prod.idaliiva ?? 3)
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
                  }
                  
                  if (newRows.every(isRowLleno)) {
                    newRows.push(getEmptyRow(modoOrdenCompra))
                  }
                  const ensured = ensureSoloUnEditable(newRows)
                  emitirCambio(ensured)
                  return ensured
                })
                if (modoLector) {
                  setIdxCodigoSiguienteFoco(idx)
                } else {
                  setIdxCantidadFoco(idx)
                }
                return
              } else {
                // PRODUCTO NO ENCONTRADO - limpiar fila (como en ItemsGrid original)
                setRows((prevRows) => {
                  const newRows = [...prevRows]
                  newRows[idx] = { ...getEmptyRow(modoOrdenCompra), id: newRows[idx].id }
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
                newRows[idx] = { ...getEmptyRow(modoOrdenCompra), id: newRows[idx].id }
                const ensured = ensureSoloUnEditable(newRows)
                emitirCambio(ensured)
                return ensured
              })
              return
            })
        }
        
        if (field === "cdi_cantidad" || field === "odi_cantidad") {
          // NUEVA LÓGICA: Siempre ir al siguiente renglón en el campo código
          // Buscar el primer renglón vacío disponible o crear uno nuevo
          let idxSiguiente = idx + 1
          
          // Si no hay siguiente renglón o está lleno, buscar el primer renglón vacío
          if (idxSiguiente >= rows.length || !isRowVacio(rows[idxSiguiente])) {
            idxSiguiente = rows.findIndex((row, i) => i > idx && isRowVacio(row))
          }
          
          // Si no hay renglón vacío, agregar uno nuevo
          if (idxSiguiente === -1) {
            setRows((prevRows) => {
              const newRows = [...prevRows, getEmptyRow(modoOrdenCompra)]
              const ensured = ensureSoloUnEditable(newRows)
              emitirCambio(ensured)
              return ensured
            })
            idxSiguiente = rows.length // El nuevo renglón será el último
          }
          
          // Mover foco al campo código del siguiente renglón
          setTimeout(() => {
            if (codigoRefs.current[idxSiguiente]) {
              codigoRefs.current[idxSiguiente].focus()
            }
          }, 0)
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
            .map((r, idx) => {
              if (modoOrdenCompra) {
                // Campos para Orden de Compra (odi_*)
                return {
                  odi_orden: idx + 1,
                  odi_idsto: r.producto ? r.producto.id : r.odi_idsto,
                  odi_idpro: r.odi_idpro || selectedProveedor?.id || null,
                  odi_cantidad: Number(r.odi_cantidad) || 0,
                  odi_detalle1: r.odi_detalle1 || (r.producto?.deno ?? ""),
                  odi_detalle2: r.odi_detalle2 || (r.producto?.unidad ?? ""),
                  odi_stock_proveedor: r.odi_stock_proveedor || null,
                }
              } else {
                // Campos para Compra (cdi_*)
                return {
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
                }
              }
            }),
        addItem: (item) => {
          const newRow = toRow(item)
          setRows((prevRows) => {
            const newRows = [...prevRows]
            
            // Verificar si ya existe un item con el mismo producto y proveedor
            const targetProdId = newRow.producto?.id || (modoOrdenCompra ? newRow.odi_idsto : newRow.cdi_idsto)
            const targetProvId = (modoOrdenCompra ? newRow.odi_idpro : newRow.cdi_idpro) || selectedProveedor?.id || null
            
            const idxExistente = newRows.findIndex((r) => {
              if (!isRowLleno(r)) return false // No comparar con filas vacías
              
              const productoExistente = r.producto?.id || (modoOrdenCompra ? r.odi_idsto : r.cdi_idsto)
              const proveedorExistente = (modoOrdenCompra ? r.odi_idpro : r.cdi_idpro) || selectedProveedor?.id || null
              
              return productoExistente === targetProdId && proveedorExistente === targetProvId
            })
            
            if (idxExistente !== -1) {
              // DUPLICADO ENCONTRADO - SUMAR CANTIDADES
              const cantidadASumar = modoOrdenCompra 
                ? (Number(newRow.odi_cantidad) > 0 ? Number(newRow.odi_cantidad) : 1)
                : (Number(newRow.cdi_cantidad) > 0 ? Number(newRow.cdi_cantidad) : 1)
              
              const updatedRows = newRows.map((r, i) => {
                if (i === idxExistente) {
                  if (modoOrdenCompra) {
                    return { ...r, odi_cantidad: Number(r.odi_cantidad) + cantidadASumar }
                  } else {
                    return { ...r, cdi_cantidad: Number(r.cdi_cantidad) + cantidadASumar }
                  }
                }
                return r
              })
              
              const ensured = ensureSoloUnEditable(updatedRows)
              emitirCambio(ensured)
              // Mover foco a cantidad del ítem existente actualizado
              setIdxCantidadFoco(idxExistente)
              return ensured
            } else {
              // NO ES DUPLICADO - agregar como nuevo item
              const lastEmptyIndex = newRows.findIndex((r) => !isRowLleno(r))
              let indiceInsertado
              if (lastEmptyIndex !== -1) {
                newRows[lastEmptyIndex] = newRow
                indiceInsertado = lastEmptyIndex
              } else {
                newRows.push(newRow)
                indiceInsertado = newRows.length - 1
              }
              // Agregar una nueva fila vacía si es necesario
              const ensured = ensureSoloUnEditable(newRows)
              emitirCambio(ensured)
              // Foco en cantidad del renglón insertado
              setIdxCantidadFoco(indiceInsertado)
              return ensured
            }
          })
        },
      }),
      [rows, selectedProveedor?.id, toRow, isRowLleno, ensureSoloUnEditable, emitirCambio, modoOrdenCompra],
    )

    return (
      <div className="space-y-3 w-full">
        {/* Checkbox Modo lector - solo visible en Orden de Compra */}
        {mostrarModoLector && (
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modoLector}
                onChange={(e) => setModoLector(e.target.checked)}
                disabled={readOnly}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Modo lector</span>
            </label>
          </div>
        )}
        <div className="w-full">
          <div className="max-h-[14rem] overflow-y-auto overscroll-contain rounded-lg border border-slate-200/50 shadow">
            <table className="min-w-full text-[12px]">
              <thead className="bg-slate-800 sticky top-0">
                <tr className="bg-slate-800">
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-8">Nro.</th>
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-28">
                    {modoOrdenCompra ? "Código Venta" : "Código"}
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-56">Producto</th>
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-16">Unidad</th>
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-20">Cantidad</th>
                  <th className="px-2 py-1 text-left font-semibold text-white uppercase tracking-wider w-10">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-2 py-1 whitespace-nowrap text-center text-[12px] text-slate-600">{idx + 1}</td>

                    {/* Código proveedor/venta */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      {readOnly ? (
                        <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center">
                          {modoOrdenCompra ? (row.codigo_venta || "") : (row.codigo_proveedor || "")}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={modoOrdenCompra ? (row.codigo_venta || "") : (row.codigo_proveedor || "")}
                          onChange={(e) => handleRowChange(idx, modoOrdenCompra ? "codigo_venta" : "codigo_proveedor", e.target.value)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, modoOrdenCompra ? "codigo_venta" : "codigo_proveedor")}
                          onFocus={manejarFocoSeleccionCompleta}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-[12px] bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-all duration-200"
                          placeholder={modoOrdenCompra ? "Código venta" : "Código proveedor"}
                          ref={(el) => (codigoRefs.current[idx] = el)}
                        />
                      )}
                    </td>

                    {/* Producto (solo lectura) */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center truncate">
                        {row.producto ? `${row.producto.codvta || row.producto.id} - ${row.producto.deno || ""}` : (modoOrdenCompra ? row.odi_detalle1 : row.cdi_detalle1) || ""}
                      </div>
                    </td>

                    {/* Unidad */}
                    <td className="px-2 py-1 whitespace-nowrap text-[12px] text-slate-600 font-medium">
                      {(modoOrdenCompra ? row.odi_detalle2 : row.cdi_detalle2) || row.unidad || "-"}
                    </td>

                    {/* Cantidad */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      {readOnly ? (
                        <div className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[30px] flex items-center">
                          {modoOrdenCompra ? row.odi_cantidad : row.cdi_cantidad}
                        </div>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={modoOrdenCompra ? row.odi_cantidad : row.cdi_cantidad}
                          onChange={(e) => handleRowChange(idx, modoOrdenCompra ? "odi_cantidad" : "cdi_cantidad", Number(e.target.value) || 0)}
                          onKeyDown={(e) => handleRowKeyDown(e, idx, modoOrdenCompra ? "odi_cantidad" : "cdi_cantidad")}
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
