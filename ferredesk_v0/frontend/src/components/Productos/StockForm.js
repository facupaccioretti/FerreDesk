"use client"

import { useState, useEffect } from "react"
import { useStockProveAPI, useStockProveEditAPI } from "../../utils/useStockProveAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import AsociarCodigoProveedorModal from "./AsociarCodigoProveedorModal"

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

const StockForm = ({ stock, onSave, onCancel, proveedores, familias, modo }) => {
  // Estado principal del formulario
  const [form, setForm] = useState(() => {
    if (modo === "nuevo") {
      const savedForm = localStorage.getItem("stockFormDraft")
      if (savedForm && !stock) {
        return JSON.parse(savedForm)
      }
      return (
        stock || {
          codvta: "",
          codcom: "",
          deno: "",
          unidad: "",
          cantmin: 0,
          proveedor_habitual_id: "",
          idfam1: null,
          idfam2: null,
          idfam3: null,
          idaliiva: "",
          id: undefined,
        }
      )
    } else {
      // Siempre incluir el id del stock en el form
      return stock
        ? { ...stock, id: stock.id }
        : {
            codvta: "",
            codcom: "",
            deno: "",
            unidad: "",
            cantmin: 0,
            proveedor_habitual_id: "",
            idfam1: null,
            idfam2: null,
            idfam3: null,
            idaliiva: "",
            id: undefined,
          }
    }
  })

  // Estado para stock y códigos pendientes SOLO en modo nuevo
  const [stockProvePendientes, setStockProvePendientes] = useState(modo === "nuevo" ? [] : [])
  const [codigosPendientes, setCodigosPendientes] = useState(modo === "nuevo" ? [] : [])

  const [newStockProve, setNewStockProve] = useState({
    stock: stock?.id || "",
    proveedor: "",
    cantidad: "",
    costo: "",
  })

  const stockProveAPI = useStockProveAPI()
  const stockProveEditAPI = useStockProveEditAPI()
  const isEdicion = !!stock?.id
  const { stockProve, addStockProve, updateStockProve, fetchStockProve } = isEdicion ? stockProveEditAPI : stockProveAPI

  const { alicuotas } = useAlicuotasIVAAPI()

  const [formError, setFormError] = useState(null)
  const [permitirCostoManual, setPermitirCostoManual] = useState(false)
  const [showAsociarModal, setShowAsociarModal] = useState(false)
  const [cargarPrecioManual, setCargarPrecioManual] = useState(false)
  const [editandoCantidadId, setEditandoCantidadId] = useState(null)
  const [nuevaCantidad, setNuevaCantidad] = useState("")

  // Array de códigos pendientes solo para edición
  const [codigosPendientesEdicion, setCodigosPendientesEdicion] = useState([])

  const [codigoProveedorDetectado, setCodigoProveedorDetectado] = useState(false)

  useEffect(() => {
    if (stock) {
      // Construir stock_proveedores para edición con solo proveedor_id
      const stockProveedores =
        stock.stock_proveedores && stock.stock_proveedores.length > 0
          ? stock.stock_proveedores.map((sp) => ({
              ...sp,
              proveedor_id: sp.proveedor_id || (sp.proveedor && (sp.proveedor.id || sp.proveedor)),
            }))
          : stockProve
              .filter((sp) => sp.stock === stock.id)
              .map((sp) => ({
                proveedor_id: sp.proveedor?.id || sp.proveedor,
                cantidad: sp.cantidad,
                costo: sp.costo,
                codigo_producto_proveedor: sp.codigo_producto_proveedor || "",
              }))

      setForm({
        codvta: stock.codvta || "",
        codcom: stock.codcom || "",
        deno: stock.deno || "",
        unidad: stock.unidad || "",
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id:
          stock.proveedor_habitual && typeof stock.proveedor_habitual === "object"
            ? String(stock.proveedor_habitual.id)
            : stock.proveedor_habitual && typeof stock.proveedor_habitual === "string"
              ? stock.proveedor_habitual
              : "",
        idfam1: stock.idfam1 && typeof stock.idfam1 === "object" ? stock.idfam1.id : (stock.idfam1 ?? null),
        idfam2: stock.idfam2 && typeof stock.idfam2 === "object" ? stock.idfam2.id : (stock.idfam2 ?? null),
        idfam3: stock.idfam3 && typeof stock.idfam3 === "object" ? stock.idfam3.id : (stock.idfam3 ?? null),
        idaliiva: stock.idaliiva && typeof stock.idaliiva === "object" ? stock.idaliiva.id : (stock.idaliiva ?? ""),
        margen: stock.margen !== undefined && stock.margen !== null ? String(stock.margen) : "",
        acti: stock.acti !== undefined && stock.acti !== null ? String(stock.acti) : "",
        id: stock.id,
        stock_proveedores: stockProveedores,
      })
      setNewStockProve((prev) => ({ ...prev, stock: stock.id }))
    }
  }, [stock, stockProve])

  useEffect(() => {
    if (modo === "nuevo" && !stock) {
      localStorage.setItem("stockFormDraft", JSON.stringify(form))
    }
  }, [form, stock, modo])

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
            setNewStockProve((prev) => ({ ...prev, stock: data.id }))
          }
        })
    }
  }, [modo, form.id])

  useEffect(() => {
    let detectado = false
    const proveedorId = newStockProve.proveedor
    if (!proveedorId) {
      setCodigoProveedorDetectado(false)
      return
    }

    if (isEdicion) {
      // 1) Verificar en los registros guardados
      const relacion = stockProve.find(
        (sp) =>
          String(sp.stock?.id || sp.stock) === String(stock?.id) &&
          String(sp.proveedor?.id || sp.proveedor) === String(proveedorId) &&
          sp.codigo_producto_proveedor,
      )
      if (relacion) detectado = true

      // 2) Verificar en los códigos pendientes de la sesión de edición
      const pendiente = codigosPendientesEdicion.find(
        (c) => String(c.proveedor_id) === String(proveedorId) && c.codigo_producto_proveedor,
      )
      if (pendiente) detectado = true

      // 3) Verificar en el estado local del formulario (puede haberse actualizado)
      if (!detectado && Array.isArray(form.stock_proveedores)) {
        const spLocal = form.stock_proveedores.find(
          (sp) => String(sp.proveedor_id) === String(proveedorId) && sp.codigo_producto_proveedor,
        )
        if (spLocal) detectado = true
      }
    } else {
      // Modo nuevo: verificar en los códigos pendientes
      const codigoPendiente = codigosPendientes.find(
        (c) => String(c.proveedor_id) === String(proveedorId) && c.codigo_producto_proveedor,
      )
      if (codigoPendiente) detectado = true
    }

    setCodigoProveedorDetectado(detectado)
  }, [newStockProve.proveedor, stockProve, codigosPendientes, codigosPendientesEdicion, form.stock_proveedores, isEdicion, stock?.id])

  useEffect(() => {
    const proveedorId = newStockProve.proveedor
    let codigoProveedor = ""
    if (proveedorId) {
      if (!isEdicion) {
        const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(proveedorId))
        if (codigoPendiente) {
          codigoProveedor = codigoPendiente.codigo_producto_proveedor
        }
      } else if (form && Array.isArray(form.stock_proveedores)) {
        const relacion = form.stock_proveedores.find((sp) => String(sp.proveedor_id) === String(proveedorId))
        if (relacion && relacion.codigo_producto_proveedor) {
          codigoProveedor = relacion.codigo_producto_proveedor
        }
      }
    }
    if (proveedorId && codigoProveedor) {
      fetch(
        `/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProveedor)}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.precio === "number" && data.precio > 0) {
            setNewStockProve((prev) => ({ ...prev, costo: String(data.precio) }))
            setPermitirCostoManual(true)
            setCargarPrecioManual(false)
          } else {
            setNewStockProve((prev) => ({ ...prev, costo: "" }))
            setPermitirCostoManual(false)
            setCargarPrecioManual(false)
          }
        })
        .catch(() => {
          setNewStockProve((prev) => ({ ...prev, costo: "" }))
          setPermitirCostoManual(false)
          setCargarPrecioManual(false)
        })
    } else if (proveedorId) {
      setPermitirCostoManual(false)
      setCargarPrecioManual(false)
      setNewStockProve((prev) => ({ ...prev, costo: "" }))
    }
  }, [newStockProve.proveedor, form, codigosPendientes, isEdicion])

  // Handler genérico y corregido para todos los campos del formulario
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

  const handleNewStockProveChange = (e) => {
    const { name, value } = e.target
    console.log("[handleNewStockProveChange] Cambio:", name, value)
    setNewStockProve((prev) => ({
      ...prev,
      [name]: name === "proveedor" ? String(value) : value,
    }))
  }

  const addStockProveHandler = async () => {
    if (!newStockProve.proveedor || !newStockProve.cantidad) {
      alert("Por favor complete todos los campos del proveedor")
      return
    }
    // Si no hay costo ingresado, impedir la operación (el código de proveedor es opcional)
    if (!newStockProve.costo) {
      alert("Debe ingresar el costo.")
      return
    }
    const proveedorExiste = proveedores.some((p) => String(p.id) === String(newStockProve.proveedor))
    if (!proveedorExiste) {
      alert("Debe seleccionar un proveedor válido.")
      return
    }
    const newProveedorId = Number.parseInt(newStockProve.proveedor)
    const newCantidad = Number.parseFloat(newStockProve.cantidad)
    const newCosto = Number.parseFloat(newStockProve.costo)

    if (!isEdicion) {
      setStockProvePendientes((prev) => {
        const existente = prev.find((sp) => sp.proveedor === newProveedorId)
        if (existente) {
          return prev.map((sp) =>
            sp.proveedor === newProveedorId
              ? { ...sp, cantidad: Number(sp.cantidad) + newCantidad, costo: newCosto }
              : sp,
          )
        } else {
          return [
            ...prev,
            {
              proveedor: newProveedorId,
              cantidad: newCantidad,
              costo: newCosto,
            },
          ]
        }
      })
      setNewStockProve({ stock: "", proveedor: "", cantidad: "", costo: "" })
      return
    }

    // EDICIÓN: directo a la API
    const currentStockId = stock.id
    const existingEntry = stockProve.find(
      (sp) => sp.stock === currentStockId && (sp.proveedor?.id || sp.proveedor) === newProveedorId,
    )
    // Obtener código de proveedor si existe (puede ser vacío y está bien)
    let codigoProductoProveedor = ""
    if (existingEntry && existingEntry.codigo_producto_proveedor) {
      codigoProductoProveedor = existingEntry.codigo_producto_proveedor
    } else {
      // Intentar ver si hay uno pendiente de asociación
      const pendiente = codigosPendientesEdicion.find((c) => String(c.proveedor_id) === String(newProveedorId))
      if (pendiente) codigoProductoProveedor = pendiente.codigo_producto_proveedor || ""
    }
    try {
      if (existingEntry) {
        await updateStockProve(existingEntry.id, {
          stockId: currentStockId,
          proveedorId: newProveedorId,
          cantidad: Number.parseFloat(existingEntry.cantidad) + newCantidad,
          costo: newCosto,
          codigo_producto_proveedor: codigoProductoProveedor,
        })
      } else {
        await addStockProve({
          stock: currentStockId,
          proveedor: newProveedorId,
          cantidad: newCantidad,
          costo: newCosto,
          codigo_producto_proveedor: codigoProductoProveedor,
        })
      }
      if (typeof fetchStockProve === "function") fetchStockProve()
      setNewStockProve({ stock: currentStockId, proveedor: "", cantidad: "", costo: "" })
    } catch (err) {
      alert(
        "Error al procesar stock de proveedor: " +
          (err.response?.data?.non_field_errors?.[0] || err.message || "Error desconocido"),
      )
    }
  }

  // Handler para asociar código de proveedor (ahora solo modifica el estado local en edición)
  const handleAsociarCodigoPendiente = async ({ proveedor_id, codigo_producto_proveedor, costo }) => {
    console.log("[handleAsociarCodigoPendiente] INICIO", {
      proveedor_id,
      codigo_producto_proveedor,
      costo,
      isEdicion,
      form,
    })
    if (!isEdicion) {
      // Validar duplicados en pendientes
      const codigoYaUsado = (codigosPendientes || []).some(
        (c) =>
          c.codigo_producto_proveedor === codigo_producto_proveedor && String(c.proveedor_id) !== String(proveedor_id),
      )
      if (codigoYaUsado) {
        console.log("[handleAsociarCodigoPendiente] Código ya usado en pendientes")
        return { ok: false, error: "Este código ya se encuentra asociado a otro producto." }
      }
      // Si el producto aún no fue guardado (ID temporal), solo guardar en pendientes
      if (!stock) {
        setCodigosPendientes((prev) => {
          const otros = (prev || []).filter((c) => String(c.proveedor_id) !== String(proveedor_id))
          return [
            ...otros,
            {
              proveedor_id,
              codigo_producto_proveedor,
              costo: costo !== "" ? costo : 0,
            },
          ]
        })
        setStockProvePendientes((prev) =>
          (prev || []).map((sp) =>
            String(sp.proveedor) === String(proveedor_id) ? { ...sp, costo: costo !== "" ? costo : 0 } : sp,
          ),
        )
        return { ok: true }
      }
    }

    // Log antes del condicional de edición
    console.log(
      "[handleAsociarCodigoPendiente] isEdicion:",
      isEdicion,
      typeof isEdicion,
      "form.id:",
      form.id,
      typeof form.id,
    )
    // Refuerzo el condicional para aceptar cualquier valor no vacío de form.id
    if (isEdicion && form.id != null && String(form.id).length > 0) {
      // Validar contra los códigos ya asociados (guardados y pendientes)
      const codigosActuales = [
        ...stockProve.map((sp) => sp.codigo_producto_proveedor).filter(Boolean),
        ...codigosPendientesEdicion.map((c) => c.codigo_producto_proveedor),
      ]
      // Si el código ya está en uso para otro proveedor, error
      const yaUsado = codigosActuales.some(
        (c, idx, arr) =>
          c === codigo_producto_proveedor &&
          // Si ya está en pendientes, que no sea para el mismo proveedor
          codigosPendientesEdicion[idx]?.proveedor_id !== proveedor_id,
      )
      if (yaUsado) {
        return { ok: false, error: "Este código ya se encuentra asociado a otro producto." }
      }
      setCodigosPendientesEdicion((prev) => {
        // Reemplaza si ya existe para ese proveedor
        const otros = prev.filter((c) => String(c.proveedor_id) !== String(proveedor_id))
        return [...otros, { proveedor_id, codigo_producto_proveedor, costo }]
      })
      // Actualizar form.stock_proveedores en el estado local para reflejar el nuevo código asociado
      setForm((prevForm) => {
        if (!Array.isArray(prevForm.stock_proveedores)) return prevForm
        const actualizado = prevForm.stock_proveedores.map((sp) =>
          String(sp.proveedor_id) === String(proveedor_id) ? { ...sp, codigo_producto_proveedor, costo } : sp,
        )
        // Si no existe, agregarlo
        const existe = actualizado.some((sp) => String(sp.proveedor_id) === String(proveedor_id))
        return {
          ...prevForm,
          stock_proveedores: existe
            ? actualizado
            : [...actualizado, { proveedor_id, codigo_producto_proveedor, costo }],
        }
      })
      return { ok: true }
    }

    if (!isEdicion && form.id) {
      try {
        const res = await fetch("/api/productos/asociar-codigo-proveedor/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          credentials: "include",
          body: JSON.stringify({
            stock_id: form.id,
            proveedor_id,
            codigo_producto_proveedor,
            costo: costo !== "" ? costo : 0,
          }),
        })
        const data = await res.json()
        console.log("[handleAsociarCodigoPendiente] Respuesta backend (nuevo):", data)
        if (!res.ok) {
          // Si el error es producto/proveedor no encontrado, mostrar mensaje claro
          if (data.detail && data.detail.includes("Producto o proveedor no encontrado")) {
            return { ok: false, error: "Debes guardar el producto antes de asociar un código de proveedor." }
          }
          console.log("[handleAsociarCodigoPendiente] Error backend (nuevo):", data.detail)
          return { ok: false, error: data.detail || "Error al validar código de proveedor" }
        }
        setCodigosPendientes((prev) => {
          const otros = (prev || []).filter((c) => String(c.proveedor_id) !== String(proveedor_id))
          return [
            ...otros,
            {
              proveedor_id,
              codigo_producto_proveedor,
              costo: costo !== "" ? costo : 0,
            },
          ]
        })
        setStockProvePendientes((prev) =>
          (prev || []).map((sp) =>
            String(sp.proveedor) === String(proveedor_id) ? { ...sp, costo: costo !== "" ? costo : 0 } : sp,
          ),
        )
        console.log("[handleAsociarCodigoPendiente] Asociación exitosa (nuevo)")
        return { ok: true }
      } catch (err) {
        console.log("[handleAsociarCodigoPendiente] Excepción (nuevo):", err)
        return { ok: false, error: err.message || "Error al validar código de proveedor" }
      }
    }
    console.log("[handleAsociarCodigoPendiente] Fallback error")
    return { ok: false, error: "No se pudo asociar el código." }
  }

  // Al guardar, aplicar los códigos pendientes de edición
  const handleSave = async (e) => {
    e.preventDefault()
    localStorage.removeItem("stockFormDraft")
    setFormError(null)
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

    if (!isEdicion && form.id) {
      formToSave.id = form.id
    }
    if (isEdicion && stock?.id) {
      formToSave.id = stock.id
    }
    try {
      let productoGuardado = null
      if (!isEdicion) {
        // NUEVO FLUJO ATÓMICO: enviar todo junto
        const stockProveedores = stockProvePendientes.map((sp) => {
          const codigoPendiente = codigosPendientes.find((c) => String(c.proveedor_id) === String(sp.proveedor))
          return {
            proveedor_id: sp.proveedor,
            cantidad: sp.cantidad,
            costo: sp.costo,
            codigo_producto_proveedor: codigoPendiente ? codigoPendiente.codigo_producto_proveedor : "",
          }
        })
        const res = await fetch("/api/productos/crear-producto-con-relaciones/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "",
          },
          credentials: "include",
          body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(data.detail || "Error al guardar el producto.")
          return
        }
        productoGuardado = { ...formToSave, id: data.producto_id }
        setStockProvePendientes([])
        setCodigosPendientes([])
        if (typeof fetchStockProve === "function") fetchStockProve()
        await onSave(productoGuardado)
      } else {
        // EDICIÓN ATÓMICA: enviar todo junto
        // Construir stock_proveedores a partir de stockProve (los reales) y codigosPendientesEdicion (los editados)
        const stockProveedores = stockProve
          .filter((sp) => sp.stock === stock.id)
          .map((sp) => {
            // Si hay un pendiente de edición para este proveedor, usar su código/costo
            const pendiente = codigosPendientesEdicion.find(
              (c) => String(c.proveedor_id) === String(sp.proveedor?.id || sp.proveedor),
            )
            return {
              proveedor_id: sp.proveedor?.id || sp.proveedor,
              cantidad: sp.cantidad,
              costo: pendiente && pendiente.costo !== undefined ? pendiente.costo : sp.costo,
              codigo_producto_proveedor: pendiente
                ? pendiente.codigo_producto_proveedor
                : sp.codigo_producto_proveedor || "",
            }
          })
        const res = await fetch("/api/productos/editar-producto-con-relaciones/", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "",
          },
          credentials: "include",
          body: JSON.stringify({
            producto: formToSave,
            stock_proveedores: stockProveedores,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setFormError(data.detail || "Error al actualizar el producto.")
          return
        }
        productoGuardado = { ...formToSave, id: data.producto_id || stock.id }
        setCodigosPendientesEdicion([])
        if (typeof fetchStockProve === "function") fetchStockProve()
        await onSave(productoGuardado)
      }
    } catch (err) {
      setFormError("Error al guardar el producto o sus relaciones.")
      return
    }
  }

  const handleCancel = () => {
    localStorage.removeItem("stockFormDraft")
    onCancel()
  }

  const stockProveForThisStock = stockProve.filter((sp) => sp.stock === stock?.id)

  const handleEditStockProve = (sp) => {
    setEditandoCantidadId(sp.id)
    setNuevaCantidad(sp.cantidad)
  }

  const handleEditStockProveCancel = () => {
    setEditandoCantidadId(null)
    setNuevaCantidad("")
  }

  const handleEditStockProveSave = async (id) => {
    const sp = stockProve.find((sp) => sp.id === id)
    if (!sp) return
    // Permitir negativos y decimales
    const cantidadNum = Number.parseFloat(String(nuevaCantidad).replace(",", "."))
    if (isNaN(cantidadNum)) {
      setFormError("Ingrese una cantidad válida")
      return
    }
    // El costo NO se modifica automáticamente al cambiar la cantidad
    const nuevoCosto = sp.costo

    await updateStockProve(id, {
      stockId: sp.stock,
      proveedorId: sp.proveedor?.id || sp.proveedor,
      cantidad: cantidadNum,
      costo: nuevoCosto,
    })
    setEditandoCantidadId(null)
    setNuevaCantidad("")
    if (typeof fetchStockProve === "function") fetchStockProve()
  }

  const handleCloseAsociarModal = () => {
    setShowAsociarModal(false)
    if (typeof fetchStockProve === "function") fetchStockProve()
  }

  console.log("form state:", JSON.stringify(form))
  console.log("select value:", form.proveedor_habitual_id)

  // Calcular el stock total sumando las cantidades de todos los proveedores
  const stockTotal = stockProveForThisStock.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0)

  // Calcular proveedores asociados dinámicamente según el estado actual del formulario
  const proveedoresAsociados = stock?.id
    ? stockProveForThisStock
        .map((sp) => (typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find((p) => p.id === sp.proveedor)))
        .filter(Boolean)
    : stockProvePendientes
        .map((sp) => (typeof sp.proveedor === "object" ? sp.proveedor : proveedores.find((p) => p.id === sp.proveedor)))
        .filter(Boolean)
  const unProveedor = proveedoresAsociados.length === 1

  // Si hay un solo proveedor, autocompletar y deshabilitar
  useEffect(() => {
    if (unProveedor && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm((prev) => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }))
    }
  }, [unProveedor, proveedoresAsociados, form.proveedor_habitual_id])

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
            // Mostrar datos pendientes (pero tomar cantidad/costo del guardado si no se editan en el modal)
            return {
              ...guardado,
              ...pendiente,
              pendiente: true,
              cantidad: guardado?.cantidad,
              costo: pendiente.costo !== undefined ? pendiente.costo : guardado?.costo,
            }
          } else {
            return guardado
          }
        })
        .filter(Boolean)
    } else if (stock?.id) {
      return stockProveForThisStock
    } else {
      // Nuevo producto: mostrar pendientes
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
      ]
    }
  })()

  // Al asociar stock, autocompletar proveedor habitual si hay uno solo
  useEffect(() => {
    if (proveedoresAsociados.length === 1 && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm((prev) => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }))
    }
  }, [proveedoresAsociados, form.proveedor_habitual_id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 p-4">
      <div className="w-full max-w-none">
        <form
          className="w-full bg-white rounded-2xl shadow-md border border-slate-200/50 relative overflow-hidden"
          onSubmit={handleSave}
        >
          {/* Gradiente decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>

          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {stock && stock.id ? "Editar Producto" : "Nuevo Producto"}
                </h3>
              </div>

              {/* Mensajes de error */}
              {formError && (
                <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formError}
                  </div>
                </div>
              )}
            </div>

            {/* Sección 1: Información Básica del Producto */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800">Información Básica del Producto</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/40">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Código de Venta *</label>
                  <input
                    type="text"
                    name="codvta"
                    value={form.codvta}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Código de Compra *</label>
                  <input
                    type="text"
                    name="codcom"
                    value={form.codcom}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Denominación *</label>
                  <input
                    type="text"
                    name="deno"
                    value={form.deno}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    name="unidad"
                    value={form.unidad}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
                  <select
                    name="acti"
                    value={form.acti ?? ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  >
                    <option value="">Sin asignar</option>
                    <option value="S">Activo</option>
                    <option value="N">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 2: Stock y Costos */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800">Stock y Costos</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/80 rounded-xl border border-emerald-200/40">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Stock Total</label>
                  <input
                    type="number"
                    value={stockTotal}
                    readOnly
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad Mínima</label>
                  <input
                    type="number"
                    name="cantmin"
                    value={form.cantmin}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Margen (%)</label>
                  <input
                    type="number"
                    name="margen"
                    value={form.margen ?? ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    step="0.01"
                    min="0"
                    placeholder="% ganancia"
                  />
                  {form.margen &&
                    newStockProve.costo &&
                    !isNaN(Number(form.margen)) &&
                    !isNaN(Number(newStockProve.costo)) && (
                      <div className="mt-1 text-xs text-emerald-700">
                        Precio sugerido: ${(Number(newStockProve.costo) * (1 + Number(form.margen) / 100)).toFixed(2)}
                      </div>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Proveedor Habitual</label>
                  <select
                    name="proveedor_habitual_id"
                    value={form.proveedor_habitual_id ?? ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    disabled={proveedoresAsociados.length === 1}
                    required={proveedoresAsociados.length > 1}
                  >
                    <option value="">Seleccione un proveedor</option>
                    {proveedoresAsociados.map((prov) => (
                      <option key={prov.id} value={String(prov.id)}>
                        {prov.razon}
                      </option>
                    ))}
                  </select>
                  {proveedoresAsociados.length > 1 && !form.proveedor_habitual_id && (
                    <div className="text-red-600 text-xs mt-1">Debe seleccionar un proveedor habitual.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Sección 3: Categorización */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800">Categorización y Fiscalización</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100/80 rounded-xl border border-purple-200/40">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Familia</label>
                  <select
                    name="idfam1"
                    value={typeof form.idfam1 === "number" || typeof form.idfam1 === "string" ? form.idfam1 : ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Sin familia</option>
                    {familias
                      .filter((fam) => String(fam.nivel) === "1")
                      .map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.deno}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Subfamilia</label>
                  <select
                    name="idfam2"
                    value={typeof form.idfam2 === "number" || typeof form.idfam2 === "string" ? form.idfam2 : ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Sin subfamilia</option>
                    {familias
                      .filter((fam) => String(fam.nivel) === "2")
                      .map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.deno}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-subfamilia</label>
                  <select
                    name="idfam3"
                    value={typeof form.idfam3 === "number" || typeof form.idfam3 === "string" ? form.idfam3 : ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Sin sub-subfamilia</option>
                    {familias
                      .filter((fam) => String(fam.nivel) === "3")
                      .map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.deno}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Alícuota de IVA *</label>
                  <select
                    name="idaliiva"
                    value={typeof form.idaliiva === "number" || typeof form.idaliiva === "string" ? form.idaliiva : ""}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    required
                  >
                    <option value="">Seleccione una alícuota</option>
                    {alicuotas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.deno} ({a.porce}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 4: Gestión de Stock por Proveedor */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Gestión de Stock por Proveedor</h4>
                </div>
                {(stock?.id || form.id) && (
                  <button
                    type="button"
                    onClick={() => setShowAsociarModal(true)}
                    className="px-4 py-2 bg-[#2F2F2F] text-white rounded-lg hover:bg-slate-700 font-semibold shadow-lg hover:shadow-xl text-sm"
                  >
                    Asociar código de proveedor
                  </button>
                )}
              </div>

              {/* Formulario para agregar stock */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 rounded-xl border border-amber-200/40 mb-4">
                <h5 className="text-md font-semibold text-slate-800 mb-3">Agregar Stock por Proveedor</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Proveedor</label>
                    <select
                      name="proveedor"
                      value={
                        typeof newStockProve.proveedor === "string" || typeof newStockProve.proveedor === "number"
                          ? newStockProve.proveedor
                          : ""
                      }
                      onChange={handleNewStockProveChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Seleccione un proveedor</option>
                      {proveedores.map((proveedor) => (
                        <option key={proveedor.id} value={String(proveedor.id)}>
                          {proveedor.razon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad</label>
                    <input
                      type="number"
                      name="cantidad"
                      value={newStockProve.cantidad}
                      onChange={handleNewStockProveChange}
                      placeholder="Cantidad"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Costo</label>
                    <input
                      type="number"
                      name="costo"
                      value={newStockProve.costo}
                      onChange={handleNewStockProveChange}
                      placeholder="Costo"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      disabled={permitirCostoManual && !cargarPrecioManual}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addStockProveHandler}
                      className="w-full px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 font-semibold shadow-lg hover:shadow-xl text-sm"
                    >
                      Agregar Stock
                    </button>
                  </div>
                </div>
                {permitirCostoManual && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cargarPrecioManual}
                      onChange={(e) => setCargarPrecioManual(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label className="text-slate-700">Cargar precio manual</label>
                  </div>
                )}
              </div>

              {/* Lista de stock por proveedor */}
              {((stock && stock.id) || (!stock?.id && stockProvePendientes.length > 0)) && (
                <div className="space-y-2">
                  <h5 className="text-md font-semibold text-slate-800 mb-3">Stock Actual por Proveedor</h5>
                  {stockProveParaMostrar.map((sp, index) => {
                    // Buscar código pendiente si corresponde
                    let codigoProveedor = sp.codigo_producto_proveedor
                    if (!codigoProveedor && !stock?.id) {
                      const codigoPendiente = codigosPendientes.find(
                        (c) => String(c.proveedor_id) === String(sp.proveedor.id || sp.proveedor),
                      )
                      if (codigoPendiente) {
                        codigoProveedor = codigoPendiente.codigo_producto_proveedor
                      }
                    }
                    return (
                      <div
                        key={sp.id || index}
                        className={`p-3 rounded-lg border ${sp.pendiente ? "bg-yellow-50 border-yellow-300" : "bg-slate-50 border-slate-200"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="font-semibold text-slate-800">
                              {typeof sp.proveedor === "object"
                                ? sp.proveedor.razon
                                : proveedores.find((p) => p.id === sp.proveedor)?.razon || sp.proveedor}
                            </span>
                            <span className="text-sm text-slate-600">
                              Código: <span className="font-medium">{codigoProveedor || "No asociado"}</span>
                            </span>
                            <span className="text-sm text-slate-600">
                              Cantidad:{" "}
                              {editandoCantidadId === sp.id ? (
                                <div className="inline-flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={nuevaCantidad}
                                    onChange={(e) => setNuevaCantidad(e.target.value)}
                                    className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                                    min="0"
                                  />
                                  <button
                                    type="button"
                                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                    onClick={() => handleEditStockProveSave(sp.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 bg-slate-400 text-white rounded hover:bg-slate-500 text-xs"
                                    onClick={handleEditStockProveCancel}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2">
                                  <span className="font-medium">{sp.cantidad}</span>
                                  <button
                                    type="button"
                                    className="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 text-xs"
                                    onClick={() => handleEditStockProve(sp)}
                                  >
                                    Editar
                                  </button>
                                </div>
                              )}
                            </span>
                            <span className="text-sm text-slate-600">
                              Costo: <span className="font-medium">${sp.costo}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium shadow-sm hover:shadow-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 font-semibold shadow-lg hover:shadow-xl"
              >
                {stock && stock.id ? "Actualizar Producto" : "Guardar Producto"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <AsociarCodigoProveedorModal
        open={showAsociarModal}
        onClose={handleCloseAsociarModal}
        producto={stock}
        productoId={stock?.id || form.id}
        proveedores={proveedores}
        onAsociarCodigoPendiente={handleAsociarCodigoPendiente}
      />
    </div>
  )
}

export default StockForm;
