import { useState, useEffect, useMemo } from "react"

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

const useStockForm = ({ stock, modo, onSave, onCancel, tabKey }) => {
// Claves para almacenar borradores de stock
  const claveBorrador = useMemo(() => {
    if (tabKey) return `stockFormDraft_${tabKey}`
    return stock?.id ? `stockFormDraft_${stock.id}` : `stockFormDraft_nuevo`
  }, [stock?.id, tabKey])

  // Estado principal del formulario con carga desde borrador si existe
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(claveBorrador)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      // Ignorar errores de parseo
    }
    // Fallback a datos iniciales
    if (stock) {
      return { ...stock, id: stock.id }
    }
    return {
      codvta: "",
      deno: "",
      unidad: "",
      cantmin: 0,
      proveedor_habitual_id: "",
      idfam1: null,
      idfam2: null,
      idfam3: null,
      idaliiva: "",
      acti: "S", // Estado por defecto: Activo para productos nuevos
      id: undefined,
    }
  })

  const [formError, setFormError] = useState(null)

  // Guardar el borrador en cualquier modo
  useEffect(() => {
    try {
      localStorage.setItem(claveBorrador, JSON.stringify(form))
    } catch (_) {
      // Ignorar errores de almacenamiento
    }
  }, [form, claveBorrador])

  // useEffect para obtener ID temporal en modo nuevo
  useEffect(() => {
    if (modo === "nuevo" && !form.id) {
      fetch("/api/productos/obtener-nuevo-id-temporal/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.id) {
            setForm((prev) => ({ ...prev, id: data.id }))
          }
        })
    }
  }, [modo, form.id])

  // Handler genérico para todos los campos del formulario
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      let finalValue = value
      // Campos que deben transformarse a número (o null si vacío)
      if (["idfam1", "idfam2", "idfam3", "idaliiva"].includes(name)) {
        finalValue = value === "" ? null : Number(value)
      } else if (name === "proveedor_habitual_id") {
        // Este campo se mantiene como string para preservar ceros a la izquierda si los hubiera
        finalValue = value === "" ? "" : String(value)
      }
      return {
        ...prev,
        [name]: finalValue,
      }
    })
  }

  // Función para actualizar el formulario desde componentes externos
  const updateForm = (updates) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  // Función para limpiar errores
  const clearError = () => {
    setFormError(null)
  }

  // Función para establecer errores
  const setError = (error) => {
    setFormError(error)
  }

  // Función para cancelar
  const handleCancel = () => {
    try { localStorage.removeItem(claveBorrador) } catch (_) {}
    onCancel()
  }

  return {
    form,
    setForm,
    formError,
    setFormError,
    handleChange,
    updateForm,
    clearError,
    setError,
    handleCancel,
    claveBorrador,
  }
}

export default useStockForm
