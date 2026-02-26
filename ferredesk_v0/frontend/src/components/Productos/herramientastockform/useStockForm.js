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

/**
 * Transforma los datos del producto (API) al formato esperado por el formulario.
 * El backend devuelve objetos anidados para relaciones (idaliiva, idfam1..3, proveedor_habitual);
 * los selects esperan IDs (número o string).
 */
function stockAFormulario(stock) {
  const idDeRelacion = (obj) => {
    if (obj == null) return null
    if (typeof obj === "object" && "id" in obj) return obj.id
    if (typeof obj === "number" || typeof obj === "string") return obj
    return null
  }
  const idAli = idDeRelacion(stock.idaliiva)
  const idFam1 = idDeRelacion(stock.idfam1)
  const idFam2 = idDeRelacion(stock.idfam2)
  const idFam3 = idDeRelacion(stock.idfam3)
  const provHab = stock.proveedor_habitual
  const proveedorHabitualId = provHab != null
    ? (typeof provHab === "object" && "id" in provHab ? String(provHab.id) : String(provHab))
    : ""

  // Normalizar stock_proveedores para tener una estructura plana y predecible
  const stockProveedores = Array.isArray(stock.stock_proveedores)
    ? stock.stock_proveedores.map(sp => ({
      ...sp,
      proveedor_id: sp.proveedor_id || (typeof sp.proveedor === "object" ? sp.proveedor.id : sp.proveedor),
    }))
    : []

  return {
    ...stock,
    id: stock.id,
    idaliiva: idAli ?? "",
    idfam1: idFam1 ?? null,
    idfam2: idFam2 ?? null,
    idfam3: idFam3 ?? null,
    proveedor_habitual_id: proveedorHabitualId,
    impuesto_interno_porcentaje: stock.impuesto_interno_porcentaje != null ? stock.impuesto_interno_porcentaje : null,
    stock_proveedores: stockProveedores,
  }
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
    // Fallback a datos iniciales: normalizar objetos anidados → IDs para selects
    if (stock) {
      return stockAFormulario(stock)
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
      impuesto_interno_porcentaje: null,
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
      } else if (name === "impuesto_interno_porcentaje") {
        finalValue = value === "" ? null : (parseFloat(value) || null)

        // --- INICIO LÓGICA DE RECALCULO DE COSTOS POR IMPUESTO INTERNO ---
        // Si el I.I. cambia, recalculamos todos los costos de proveedores asociados.
        // Asumimos que el costo actual ya tiene el I.I. anterior (si lo había).
        const oldImpuesto = prev.impuesto_interno_porcentaje || 0
        const newImpuesto = finalValue || 0

        // Multiplicador para "limpiar" el costo viejo y aplicar el nuevo
        // Ej: paso de 0% a 10%: factor = (1 + 0.10) / (1 + 0.00) = 1.10
        // Ej: paso de 10% a 20%: factor = (1 + 0.20) / (1 + 1.10) = 1.0909...
        const factorMultiplicador = (1 + (newImpuesto / 100)) / (1 + (oldImpuesto / 100))

        const newStockProveedores = (prev.stock_proveedores || []).map(sp => {
          if (!sp.costo) return sp
          const currentCosto = parseFloat(sp.costo) || 0
          // Redondeamos a 2 decimales para evitar basuras flotantes
          const nuevoCosto = Number((currentCosto * factorMultiplicador).toFixed(2))
          return { ...sp, costo: nuevoCosto }
        })

        return {
          ...prev,
          [name]: finalValue,
          stock_proveedores: newStockProveedores
        }
        // --- FIN LÓGICA DE RECALCULO ---

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
    try {
      localStorage.removeItem(claveBorrador)
      localStorage.removeItem(`${claveBorrador}_precios`)
      localStorage.removeItem(`${claveBorrador}_spPendientes`)
      localStorage.removeItem(`${claveBorrador}_codPendientes`)
      localStorage.removeItem(`${claveBorrador}_provAgregados`)
      localStorage.removeItem(`${claveBorrador}_codPendEdic`)
    } catch (_) { }
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
