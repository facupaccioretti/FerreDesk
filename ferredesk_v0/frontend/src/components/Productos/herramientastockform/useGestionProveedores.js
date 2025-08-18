import { useState } from "react"

const useGestionProveedores = ({ stock, modo, proveedores, stockProve, form, updateForm, setFormError, updateStockProve, fetchStockProve }) => {
  const isEdicion = !!stock?.id

  // Stock prove para este stock específico - debe definirse primero
  const stockProveForThisStock = stockProve.filter((sp) => sp.stock === stock?.id)

  // Estado para stock y códigos pendientes SOLO en modo nuevo
  const [stockProvePendientes, setStockProvePendientes] = useState(modo === "nuevo" ? [] : [])
  const [codigosPendientes, setCodigosPendientes] = useState(modo === "nuevo" ? [] : [])

  // Nuevo estado para manejar proveedores agregados en modo nuevo
  const [proveedoresAgregados, setProveedoresAgregados] = useState(modo === "nuevo" ? [] : [])

  // Eliminado formulario de agregar proveedor: no se requiere estado temporal para newStockProve

  // Array de códigos pendientes solo para edición
  const [codigosPendientesEdicion, setCodigosPendientesEdicion] = useState([])

  // Estados para edición de proveedores agregados en modo nuevo
  const [editandoCantidadProveedorId, setEditandoCantidadProveedorId] = useState(null)
  const [nuevaCantidadProveedor, setNuevaCantidadProveedor] = useState("")
  const [editandoCostoProveedorId, setEditandoCostoProveedorId] = useState(null)
  const [nuevoCostoProveedor, setNuevoCostoProveedor] = useState("")

  // Estados para edición de stock existente
  const [editandoCantidadId, setEditandoCantidadId] = useState(null)
  const [nuevaCantidad, setNuevaCantidad] = useState("")
  const [editandoCostoId, setEditandoCostoId] = useState(null)
  const [nuevoCosto, setNuevoCosto] = useState("")

  // Sincronización de estados ya no requiere actualizar newStockProve

  // Eliminada lógica de cambios del formulario de proveedor

  // Eliminado handler de agregar proveedor en edición

  // Eliminado handler de agregar proveedor en modo nuevo

  // Handler para eliminar un proveedor agregado en modo edición
  const handleEliminarProveedorEdicion = (proveedorId) => {
    // Remover de codigosPendientesEdicion
    setCodigosPendientesEdicion((prev) => 
      prev.filter((c) => String(c.proveedor_id) !== String(proveedorId))
    )
    
    // Remover de form.stock_proveedores
    updateForm({
      stock_proveedores: (form.stock_proveedores || []).filter((sp) => 
        String(sp.proveedor_id) !== String(proveedorId)
      )
    })
  }

  // Handler para eliminar un proveedor agregado
  const handleEliminarProveedor = (proveedorId) => {
    setProveedoresAgregados((prev) => prev.filter((p) => p.proveedor !== proveedorId))
  }

  // Handler para editar cantidad de un proveedor agregado (con confirmación)
  const handleEditarCantidadProveedor = (proveedorId) => {
    let proveedor
    if (isEdicion) {
      // En modo edición, buscar en codigosPendientesEdicion
      proveedor = codigosPendientesEdicion.find((c) => String(c.proveedor_id) === String(proveedorId))
    } else {
      // En modo nuevo, buscar en proveedoresAgregados
      proveedor = proveedoresAgregados.find((p) => p.proveedor === proveedorId)
    }
    
    if (proveedor) {
      setEditandoCantidadProveedorId(proveedorId)
      setNuevaCantidadProveedor(String(proveedor.cantidad || 0))
    }
  }

  const handleEditarCantidadProveedorSave = (proveedorId) => {
    const cantidadNum = Number.parseFloat(String(nuevaCantidadProveedor).replace(",", "."))
    if (isNaN(cantidadNum)) {
      setFormError("Ingrese una cantidad válida")
      return
    }
    
    if (isEdicion) {
      // En modo edición, actualizar codigosPendientesEdicion
      setCodigosPendientesEdicion((prev) =>
        prev.map((c) =>
          String(c.proveedor_id) === String(proveedorId) ? { ...c, cantidad: cantidadNum } : c
        )
      )
      
      // Actualizar también form.stock_proveedores
      updateForm({
        stock_proveedores: (form.stock_proveedores || []).map((sp) =>
          String(sp.proveedor_id) === String(proveedorId) ? { ...sp, cantidad: cantidadNum } : sp
        )
      })
    } else {
      // En modo nuevo, actualizar proveedoresAgregados
      setProveedoresAgregados((prev) =>
        prev.map((p) =>
          p.proveedor === proveedorId ? { ...p, cantidad: cantidadNum } : p
        )
      )
    }
    
    setEditandoCantidadProveedorId(null)
    setNuevaCantidadProveedor("")
  }

  const handleEditarCantidadProveedorCancel = () => {
    setEditandoCantidadProveedorId(null)
    setNuevaCantidadProveedor("")
  }

  // Handler para editar costo de un proveedor agregado (con confirmación)
  const handleEditarCostoProveedor = (proveedorId) => {
    let proveedor
    if (isEdicion) {
      // En modo edición, buscar en codigosPendientesEdicion
      proveedor = codigosPendientesEdicion.find((c) => String(c.proveedor_id) === String(proveedorId))
    } else {
      // En modo nuevo, buscar en proveedoresAgregados
      proveedor = proveedoresAgregados.find((p) => p.proveedor === proveedorId)
    }
    
    if (proveedor) {
      setEditandoCostoProveedorId(proveedorId)
      setNuevoCostoProveedor(String(proveedor.costo || 0))
    }
  }

  const handleEditarCostoProveedorSave = (proveedorId) => {
    const costoNum = Number.parseFloat(String(nuevoCostoProveedor).replace(",", "."))
    if (isNaN(costoNum)) {
      setFormError("Ingrese un costo válido")
      return
    }
    
    if (isEdicion) {
      // En modo edición, actualizar codigosPendientesEdicion
      setCodigosPendientesEdicion((prev) =>
        prev.map((c) =>
          String(c.proveedor_id) === String(proveedorId) ? { ...c, costo: costoNum } : c
        )
      )
      
      // Actualizar también form.stock_proveedores
      updateForm({
        stock_proveedores: (form.stock_proveedores || []).map((sp) =>
          String(sp.proveedor_id) === String(proveedorId) ? { ...sp, costo: costoNum } : sp
        )
      })
    } else {
      // En modo nuevo, actualizar proveedoresAgregados
      setProveedoresAgregados((prev) =>
        prev.map((p) =>
          p.proveedor === proveedorId ? { ...p, costo: costoNum } : p
        )
      )
    }
    
    setEditandoCostoProveedorId(null)
    setNuevoCostoProveedor("")
  }

  const handleEditarCostoProveedorCancel = () => {
    setEditandoCostoProveedorId(null)
    setNuevoCostoProveedor("")
  }

  // Handlers para edición de stock existente
  const handleEditStockProve = (sp) => {
    setEditandoCantidadId(sp.id)
    setNuevaCantidad(sp.cantidad)
  }

  const handleEditCostoStockProve = (sp) => {
    setEditandoCostoId(sp.id)
    setNuevoCosto(sp.costo)
  }

  const handleEditStockProveCancel = () => {
    setEditandoCantidadId(null)
    setNuevaCantidad("")
    setEditandoCostoId(null)
    setNuevoCosto("")
  }

  // Handler para guardar edición de cantidad de stock existente
  const handleEditStockProveSave = async (id) => {
    // Verificar si es un proveedor pendiente (ID temporal)
    if (typeof id === 'string' && id.startsWith('pendiente-')) {
      const proveedorId = id.replace('pendiente-', '')
      const cantidadNum = Number.parseFloat(String(nuevaCantidad).replace(",", "."))
      if (isNaN(cantidadNum)) {
        setFormError("Ingrese una cantidad válida")
        return
      }
      
      // Actualizar codigosPendientesEdicion
      setCodigosPendientesEdicion((prev) => 
        prev.map((c) => 
          String(c.proveedor_id) === String(proveedorId)
            ? { ...c, cantidad: cantidadNum }
            : c
        )
      )
      
      // Actualizar form.stock_proveedores
      updateForm({
        stock_proveedores: (form.stock_proveedores || []).map((sp) =>
          String(sp.proveedor_id) === String(proveedorId)
            ? { ...sp, cantidad: cantidadNum }
            : sp
        )
      })
      
      setEditandoCantidadId(null)
      setNuevaCantidad("")
      return
    }
    
    // Proveedor existente en stockProve
    const sp = stockProve.find((sp) => sp.id === id)
    if (!sp) return
    // Permitir negativos y decimales
    const cantidadNum = Number.parseFloat(String(nuevaCantidad).replace(",", "."))
    if (isNaN(cantidadNum)) {
      setFormError("Ingrese una cantidad válida")
      return
    }
    
    // Para proveedores existentes, actualizar codigosPendientesEdicion en lugar de llamar a updateStockProve
    const proveedorId = sp.proveedor?.id || sp.proveedor
    setCodigosPendientesEdicion((prev) => {
      const otros = prev.filter((c) => String(c.proveedor_id) !== String(proveedorId))
      return [...otros, { 
        proveedor_id: proveedorId,
        cantidad: cantidadNum,
        costo: sp.costo, // Mantener el costo actual
        // No forzar código vacío; si existe, preservarlo para el payload final
        ...(sp.codigo_producto_proveedor ? { codigo_producto_proveedor: sp.codigo_producto_proveedor } : {})
      }]
    })
    
    // Actualizar también form.stock_proveedores
    updateForm({
      stock_proveedores: (form.stock_proveedores || []).map((sp) =>
        String(sp.proveedor_id) === String(proveedorId)
          ? { ...sp, cantidad: cantidadNum }
          : sp
      )
    })
    
    setEditandoCantidadId(null)
    setNuevaCantidad("")
  }

  // Handler para guardar edición de costo de stock existente
  const handleEditCostoStockProveSave = async (id) => {
    // Verificar si es un proveedor pendiente (ID temporal)
    if (typeof id === 'string' && id.startsWith('pendiente-')) {
      const proveedorId = id.replace('pendiente-', '')
      const costoNum = Number.parseFloat(String(nuevoCosto).replace(",", "."))
      if (isNaN(costoNum) || costoNum < 0) {
        setFormError("Ingrese un costo válido")
        return
      }
      
      // Actualizar codigosPendientesEdicion
      setCodigosPendientesEdicion((prev) => 
        prev.map((c) => 
          String(c.proveedor_id) === String(proveedorId)
            ? { ...c, costo: costoNum }
            : c
        )
      )
      
      // Actualizar form.stock_proveedores
      updateForm({
        stock_proveedores: (form.stock_proveedores || []).map((sp) =>
          String(sp.proveedor_id) === String(proveedorId)
            ? { ...sp, costo: costoNum }
            : sp
        )
      })
      
      setEditandoCostoId(null)
      setNuevoCosto("")
      return
    }
    
    // Proveedor existente en stockProve
    const sp = stockProve.find((sp) => sp.id === id)
    if (!sp) return
    const costoNum = Number.parseFloat(String(nuevoCosto).replace(",", "."))
    if (isNaN(costoNum) || costoNum < 0) {
      setFormError("Ingrese un costo válido")
      return
    }

    // Para proveedores existentes, actualizar codigosPendientesEdicion en lugar de llamar a updateStockProve
    const proveedorId = sp.proveedor?.id || sp.proveedor
    setCodigosPendientesEdicion((prev) => {
      const otros = prev.filter((c) => String(c.proveedor_id) !== String(proveedorId))
      return [...otros, { 
        proveedor_id: proveedorId,
        cantidad: sp.cantidad, // Mantener la cantidad actual
        costo: costoNum,
        ...(sp.codigo_producto_proveedor ? { codigo_producto_proveedor: sp.codigo_producto_proveedor } : {})
      }]
    })
    
    // Actualizar también form.stock_proveedores
    updateForm({
      stock_proveedores: (form.stock_proveedores || []).map((sp) =>
        String(sp.proveedor_id) === String(proveedorId)
          ? { ...sp, costo: costoNum }
          : sp
      )
    })
    
    setEditandoCostoId(null)
    setNuevoCosto("")
  }

  // Calcular stock total
  const stockTotal = (() => {
    if (stock?.id) {
      // En modo edición, sumar stockProveForThisStock y proveedores agregados en edición
      const totalStockProve = stockProveForThisStock.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)
      const totalPendientesEdicion = codigosPendientesEdicion
        .filter((pendiente) => {
          // Solo incluir si no está en stockProve (proveedores agregados durante la edición)
          return !stockProve.some((sp) => 
            sp.stock === stock.id && 
            String(sp.proveedor?.id || sp.proveedor) === String(pendiente.proveedor_id)
          )
        })
        .reduce((sum, pendiente) => sum + (Number(pendiente.cantidad) || 0), 0)
      return totalStockProve + totalPendientesEdicion
    } else {
      // En modo nuevo, sumar stockProvePendientes y proveedoresAgregados
      const totalPendientes = stockProvePendientes.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)
      const totalAgregados = proveedoresAgregados.reduce((sum, pa) => sum + (Number(pa.cantidad) || 0), 0)
      return totalPendientes + totalAgregados
    }
  })()

  // Calcular proveedores asociados dinámicamente
  const proveedoresAsociados = (() => {
    if (stock?.id) {
      // En modo edición, incluir stockProveForThisStock y proveedores agregados en edición
      const proveedoresStockProve = stockProveForThisStock
        .map((sp) => (typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find((p) => p.id === sp.proveedor)))
        .filter(Boolean)
      
      const proveedoresPendientesEdicion = codigosPendientesEdicion
        .filter((pendiente) => {
          // Solo incluir si no está en stockProve (proveedores agregados durante la edición)
          return !stockProve.some((sp) => 
            sp.stock === stock.id && 
            String(sp.proveedor?.id || sp.proveedor) === String(pendiente.proveedor_id)
          )
        })
        .map((pendiente) => proveedores.find((p) => p.id === pendiente.proveedor_id))
        .filter(Boolean)
      
      return [...proveedoresStockProve, ...proveedoresPendientesEdicion]
    } else {
      return [
        ...stockProvePendientes
        .map((sp) => (typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find((p) => p.id === sp.proveedor)))
          .filter(Boolean),
        ...proveedoresAgregados
          .map((pa) => proveedores.find((p) => p.id === pa.proveedor))
        .filter(Boolean)
      ]
    }
  })()

  // Mezclar stock de proveedor real y pendientes de edición para mostrar en la tabla
  const stockProveParaMostrar = (() => {
    if (isEdicion) {
      // Mapear por proveedor los datos guardados
      const guardadosPorProveedor = Object.fromEntries(
        stockProveForThisStock.map((sp) => [String(sp.proveedor?.id || sp.proveedor), sp]),
      )
      // Mapear por proveedor los pendientes
      const pendientesPorProveedor = Object.fromEntries(
        codigosPendientesEdicion.map((c) => [String(c.proveedor_id), c]),
      )
      // Unir claves
      const proveedoresUnicos = Array.from(
        new Set([...Object.keys(guardadosPorProveedor), ...Object.keys(pendientesPorProveedor)]),
      )
      // Construir array final
      return proveedoresUnicos
        .map((provId) => {
          const pendiente = pendientesPorProveedor[provId]
          const guardado = guardadosPorProveedor[provId]
          if (pendiente) {
            // Si hay pendiente, construir el objeto
            const proveedorInfo = proveedores.find((p) => p.id === Number(provId))
            return {
              ...guardado, // Info del guardado si existe
              ...pendiente, // Código y costo pendientes
              proveedor: guardado?.proveedor || proveedorInfo, // Usar proveedor del guardado o buscarlo
              id: guardado?.id || `pendiente-${provId}`, // ID del guardado o temporal
              cantidad: pendiente.cantidad !== undefined ? pendiente.cantidad : (guardado?.cantidad || 0), // Usar cantidad del pendiente si está definida
              pendiente: true,
              costo: pendiente.costo !== undefined ? pendiente.costo : guardado?.costo,
            }
          } else {
            return guardado
          }
        })
        .filter(Boolean)
    } else if (stock?.id) {
      return stockProveForThisStock.map((sp) => ({
        ...sp,
        id: sp.id || `stock-${sp.proveedor?.id || sp.proveedor}`
      }))
    } else {
      // Nuevo producto: mostrar pendientes y proveedores agregados
      return [
        ...stockProvePendientes.map((sp, idx) => ({
          ...sp,
          id: `pendiente-${sp.proveedor}`,
          proveedor:
            typeof sp.proveedor === "object"
              ? sp.proveedor
              : proveedores.find((p) => p.id === sp.proveedor) || sp.proveedor,
          codigo_producto_proveedor: "", // No hay código asociado aún
        })),
        ...proveedoresAgregados.map((pa, idx) => ({
          ...pa,
          id: `agregado-${pa.proveedor}`,
          proveedor: proveedores.find((p) => p.id === pa.proveedor) || pa.proveedor,
          codigo_producto_proveedor: "", // No hay código asociado aún
          pendiente: true, // Marcar como pendiente para mostrar con fondo amarillo
        }))
      ]
    }
  })()



  return {
    // Estados
    stockProvePendientes,
    setStockProvePendientes,
    codigosPendientes,
    setCodigosPendientes,
    proveedoresAgregados,
    setProveedoresAgregados,
    codigosPendientesEdicion,
    setCodigosPendientesEdicion,
    
    // Estados de edición
    editandoCantidadProveedorId,
    nuevaCantidadProveedor,
    setNuevaCantidadProveedor,
    editandoCostoProveedorId,
    nuevoCostoProveedor,
    setNuevoCostoProveedor,
    editandoCantidadId,
    nuevaCantidad,
    setNuevaCantidad,
    editandoCostoId,
    nuevoCosto,
    setNuevoCosto,
    
    // Handlers
    handleEliminarProveedorEdicion,
    handleEliminarProveedor,
    handleEditarCantidadProveedor,
    handleEditarCantidadProveedorSave,
    handleEditarCantidadProveedorCancel,
    handleEditarCostoProveedor,
    handleEditarCostoProveedorSave,
    handleEditarCostoProveedorCancel,
    handleEditStockProve,
    handleEditCostoStockProve,
    handleEditStockProveCancel,
    handleEditStockProveSave,
    handleEditCostoStockProveSave,
    
    // Cálculos
    stockTotal,
    proveedoresAsociados,
    stockProveParaMostrar,
    stockProveForThisStock,
    
    // Utilidades
    isEdicion,
  }
}

export default useGestionProveedores
