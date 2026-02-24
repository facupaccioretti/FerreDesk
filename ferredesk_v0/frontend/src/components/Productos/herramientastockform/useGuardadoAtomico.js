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

const useGuardadoAtomico = ({ modo, stock, onSave }) => {
  const [isSaving, setIsSaving] = useState(false)

  // Función principal de guardado atómico (Simplificada para usar el estado unificado)
  const guardarProductoAtomico = async (form) => {
    setIsSaving(true)

    try {
      // Preparar el formulario para el guardado
      const formToSave = { ...form }

      // Asegurar que los IDs de relación se envíen correctamente (id_*_id para el backend)
      if (formToSave.idfam1 !== null) formToSave.idfam1_id = formToSave.idfam1
      if (formToSave.idfam2 !== null) formToSave.idfam2_id = formToSave.idfam2
      if (formToSave.idfam3 !== null) formToSave.idfam3_id = formToSave.idfam3
      if (formToSave.idaliiva !== null && formToSave.idaliiva !== undefined) formToSave.idaliiva_id = formToSave.idaliiva

      delete formToSave.idfam1
      delete formToSave.idfam2
      delete formToSave.idfam3
      delete formToSave.idaliiva

      // Margen y Impuesto Interno
      if (formToSave.impuesto_interno_porcentaje === "" || formToSave.impuesto_interno_porcentaje === undefined) {
        formToSave.impuesto_interno_porcentaje = null
      }

      // ID del producto
      if (!stock?.id && form.id) formToSave.id = form.id
      if (stock?.id) formToSave.id = stock.id

      // Normalizar stock_proveedores para el envío
      const stockProveedores = (form.stock_proveedores || []).map((sp) => ({
        proveedor_id: Number(sp.proveedor_id || (sp.proveedor?.id || sp.proveedor)),
        cantidad: Number(sp.cantidad) || 0,
        costo: Number(sp.costo) || 0,
        codigo_producto_proveedor: sp.codigo_producto_proveedor || ""
      }))

      const endpoint = !stock?.id
        ? "/api/productos/crear-producto-con-relaciones/"
        : "/api/productos/editar-producto-con-relaciones/"

      const method = !stock?.id ? "POST" : "PUT"

      const response = await fetch(endpoint, {
        method,
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
        if (data.errors?.errors?.codvta?.length > 0) {
          errorMsg = data.errors.errors.codvta[0]
        } else if (data.error) {
          errorMsg = data.error
        } else {
          errorMsg = data.detail || JSON.stringify(data)
        }
        alert(errorMsg)
        return { success: false, error: errorMsg }
      }

      const productoGuardado = { ...formToSave, id: data.producto_id || stock?.id }
      if (onSave) await onSave(productoGuardado)
      return { success: true, data: productoGuardado }

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
