import { useState, useMemo } from "react"

const useGestionProveedores = ({ stock, modo, proveedores, stockProve, form, updateForm, alert, fetchStockProve }) => {
  const isEdicion = !!stock?.id

  // Estados para edición de stock (cantidad y costo)
  const [editandoCantidadId, setEditandoCantidadId] = useState(null)
  const [nuevaCantidad, setNuevaCantidad] = useState("")
  const [editandoCostoId, setEditandoCostoId] = useState(null)
  const [nuevoCosto, setNuevoCosto] = useState("")

  // Cálculos dinámicos basados exclusivamente en form.stock_proveedores
  const stockProveParaMostrar = useMemo(() => {
    return (form.stock_proveedores || []).map(sp => {
      // Normalizar proveedor para la UI (asegurar que sea un objeto para mostrar RAZÓN)
      const proveedorInfo = typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find(p => p.id === Number(sp.proveedor_id || sp.proveedor))
      return {
        ...sp,
        id: sp.id || `temp-${sp.proveedor_id}`,
        proveedor: proveedorInfo || sp.proveedor,
      }
    })
  }, [form.stock_proveedores, proveedores])

  const proveedoresAsociados = (() => {
    const vistos = new Set()
    const result = []
    stockProveParaMostrar.forEach(sp => {
      const pId = sp.proveedor_id || (typeof sp.proveedor === "object" ? sp.proveedor.id : sp.proveedor)
      if (pId && !vistos.has(String(pId))) {
        vistos.add(String(pId))
        const pInfo = typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find(p => p.id === Number(pId))
        if (pInfo) result.push(pInfo)
      }
    })
    return result
  })()

  const stockTotal = stockProveParaMostrar.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)

  // Handlers
  const handleEditStockProve = (sp) => {
    setEditandoCantidadId(sp.id)
    setNuevaCantidad(String(sp.cantidad))
  }

  const handleEditCostoStockProve = (sp) => {
    setEditandoCostoId(sp.id)
    setNuevoCosto(String(sp.costo))
  }

  const handleEditCancel = () => {
    setEditandoCantidadId(null)
    setNuevaCantidad("")
    setEditandoCostoId(null)
    setNuevoCosto("")
  }

  const handleEditSave = (id, field) => {
    const val = field === "cantidad" ? nuevaCantidad : nuevoCosto
    const num = parseFloat(String(val).replace(",", "."))
    if (isNaN(num)) {
      alert(`Ingrese un ${field === "cantidad" ? "stock" : "costo"} válido`)
      return
    }

    updateForm({
      stock_proveedores: (form.stock_proveedores || []).map(sp => {
        const spId = sp.id || `temp-${sp.proveedor_id}`
        if (spId === id) {
          return { ...sp, [field]: num, pendiente: true }
        }
        return sp
      })
    })

    handleEditCancel()
  }

  const handleEliminarRelacion = (proveedorId) => {
    updateForm({
      stock_proveedores: (form.stock_proveedores || []).filter(sp =>
        String(sp.proveedor_id) !== String(proveedorId)
      )
    })
  }

  // Lógica de reversión para la cruz (X)
  const handleRevertirCambios = (proveedorId) => {
    const original = stock?.stock_proveedores?.find(sp =>
      String(sp.proveedor_id || (typeof sp.proveedor === "object" ? sp.proveedor.id : sp.proveedor)) === String(proveedorId)
    )

    if (original) {
      // Si existía originalmente, restaurar sus valores
      updateForm({
        stock_proveedores: (form.stock_proveedores || []).map(sp =>
          String(sp.proveedor_id) === String(proveedorId)
            ? {
              ...sp,
              cantidad: original.cantidad,
              costo: original.costo,
              codigo_producto_proveedor: original.codigo_producto_proveedor,
              pendiente: false
            }
            : sp
        )
      })
    } else {
      // Si era nuevo, eliminarlo
      handleEliminarRelacion(proveedorId)
    }
  }

  return {
    // Estados y Cálculos
    stockTotal,
    proveedoresAsociados,
    stockProveParaMostrar,
    isEdicion,

    // UI States
    editandoCantidadId,
    nuevaCantidad,
    setNuevaCantidad,
    editandoCostoId,
    nuevoCosto,
    setNuevoCosto,

    // Handlers
    handleEditStockProve,
    handleEditCostoStockProve,
    handleEditCancel,
    handleEditStockProveSave: (id) => handleEditSave(id, "cantidad"),
    handleEditCostoStockProveSave: (id) => handleEditSave(id, "costo"),
    handleEliminarRelacion: handleRevertirCambios, // Mapear a la lógica de reversión inteligente
    handleEliminarProveedor: handleRevertirCambios, // Para compatibilidad con StockForm component
  }
}

export default useGestionProveedores
