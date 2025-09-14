import { useState } from "react"

// Función para obtener el token CSRF de la cookie
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

const useGuardadoAtomico = ({ modo, stock, stockProve, onSave }) => {
  const [isSaving, setIsSaving] = useState(false)

  // Función principal de guardado atómico
  const guardarProductoAtomico = async (form, stockProvePendientes, codigosPendientes, proveedoresAgregados, codigosPendientesEdicion, setFormError, setStockProvePendientes, setCodigosPendientes, setProveedoresAgregados, setCodigosPendientesEdicion, fetchStockProve) => {
    setIsSaving(true)
    
    try {
      // Preparar el formulario para el guardado
      const formToSave = { ...form }
      
      // Asegurar que los IDs de familia se envíen correctamente
      if (formToSave.idfam1 !== null) formToSave.idfam1_id = formToSave.idfam1
      if (formToSave.idfam2 !== null) formToSave.idfam2_id = formToSave.idfam2
      if (formToSave.idfam3 !== null) formToSave.idfam3_id = formToSave.idfam3
      
      // Limpiar los campos originales para evitar duplicación
      delete formToSave.idfam1
      delete formToSave.idfam2
      delete formToSave.idfam3
      
      // Asegurar que el ID de alícuota IVA se envíe correctamente
      if (formToSave.idaliiva !== null && formToSave.idaliiva !== undefined) formToSave.idaliiva_id = formToSave.idaliiva
      delete formToSave.idaliiva

      // Asegurar que el ID del producto se envíe correctamente (EXACTAMENTE como en el original)
      if (!stock?.id && form.id) {
        formToSave.id = form.id
      }
      if (stock?.id) {
        formToSave.id = stock.id
      }

      let productoGuardado = null
      if (!stock?.id) {
        // NUEVO FLUJO ATÓMICO: enviar todo junto
        // Combinar stockProvePendientes y proveedoresAgregados
        const stockProveedores = [
          ...stockProvePendientes.map((sp) => {
            const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(sp.proveedor))
            return {
              proveedor_id: sp.proveedor,
              cantidad: sp.cantidad,
              costo: sp.costo,
              // Priorizar código del pendiente; si no está, respetar código ya guardado en estructura pendiente si existiera
              ...(codigoPendiente && codigoPendiente.codigo_producto_proveedor
                ? { codigo_producto_proveedor: codigoPendiente.codigo_producto_proveedor }
                : (sp.codigo_producto_proveedor
                  ? { codigo_producto_proveedor: sp.codigo_producto_proveedor }
                  : {})),
            }
          }),
          ...proveedoresAgregados.map((pa) => {
            const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(pa.proveedor))
            return {
              proveedor_id: pa.proveedor,
              cantidad: pa.cantidad,
              costo: pa.costo,
              // Incluir el código si viene desde pendientes o si ya está en el objeto agregado
              ...(codigoPendiente && codigoPendiente.codigo_producto_proveedor
                ? { codigo_producto_proveedor: codigoPendiente.codigo_producto_proveedor }
                : (pa.codigo_producto_proveedor
                  ? { codigo_producto_proveedor: pa.codigo_producto_proveedor }
                  : {})),
            }
          })
        ]
        
        const response = await fetch("/api/productos/crear-producto-con-relaciones/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          credentials: "include",
          body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores,
          }),
        })
        
        const data = await response.json()
        if (!response.ok) {
          let errorMsg = "Error al guardar el producto."
          // Manejo específico para errores de validación de campos anidados como codvta
          if (data.errors && data.errors.errors && data.errors.errors.codvta && data.errors.errors.codvta.length > 0) {
            errorMsg = data.errors.errors.codvta[0];
          } 
          // Manejo para errores de protección más simples
          else if (data.error) {
            errorMsg = data.error;
          }
          // Fallback para otros formatos de error de DRF
          else {
            errorMsg = data.detail || JSON.stringify(data);
          }
          alert(errorMsg)
          return { success: false, error: errorMsg }
        }
        
        productoGuardado = { ...formToSave, id: data.producto_id }
        setStockProvePendientes([])
        setCodigosPendientes([])
        // Limpiar proveedoresAgregados también
        if (typeof setProveedoresAgregados === "function") setProveedoresAgregados([])
        if (typeof fetchStockProve === "function") fetchStockProve()
        if (onSave) await onSave(productoGuardado)
        return { success: true, data: productoGuardado }
      } else {
        // EDICIÓN ATÓMICA: enviar todo junto
        // Construir stock_proveedores a partir del DETALLE actual (form.stock_proveedores)
        // SOLUCIÓN SIMPLIFICADA: usar solo form.stock_proveedores como fuente única de verdad
        const stockProveedores = Array.isArray(form.stock_proveedores) 
          ? form.stock_proveedores.map((sp) => ({
              proveedor_id: Number(sp.proveedor_id || sp.proveedor?.id || sp.proveedor),
              cantidad: sp.cantidad ?? 0,
              costo: sp.costo ?? 0,
              ...(sp.codigo_producto_proveedor ? { codigo_producto_proveedor: sp.codigo_producto_proveedor } : {})
            }))
          : []
        
        const response = await fetch("/api/productos/editar-producto-con-relaciones/", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          credentials: "include",
          body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores,
          }),
        })
        
        const data = await response.json()
        if (!response.ok) {
          let errorMsg = "Error al actualizar el producto."
          // Manejo específico para errores de validación de campos anidados como codvta
          if (data.errors && data.errors.errors && data.errors.errors.codvta && data.errors.errors.codvta.length > 0) {
            errorMsg = data.errors.errors.codvta[0];
          } 
          // Manejo para errores de protección más simples
          else if (data.error) {
            errorMsg = data.error;
          }
          // Fallback para otros formatos de error de DRF
          else {
            errorMsg = data.detail || JSON.stringify(data);
          }
          alert(errorMsg)
          return { success: false, error: errorMsg }
        }
        
        productoGuardado = { ...formToSave, id: data.producto_id || stock.id }
        setCodigosPendientesEdicion([])
        if (typeof fetchStockProve === "function") fetchStockProve()
        if (onSave) await onSave(productoGuardado)
        return { success: true, data: productoGuardado }
      }
      
    } catch (error) {
      console.error("Error en guardado atómico:", error)
      const errorMsg = "Error al guardar el producto o sus relaciones."
      alert(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsSaving(false)
    }
  }

  return {
    isSaving,
    guardarProductoAtomico
  }
}

export default useGuardadoAtomico
