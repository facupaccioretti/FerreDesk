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

const useAsociacionCodigos = ({ 
  stock, 
  modo, 
  form, 
  stockProve, 
  codigosPendientes, 
  setCodigosPendientes, 
  codigosPendientesEdicion, 
  setCodigosPendientesEdicion,
  stockProvePendientes,
  setStockProvePendientes,
  proveedoresAgregados,
  setProveedoresAgregados,
  updateForm,
  setFormError 
}) => {
  const isEdicion = !!stock?.id

  // Estados para el componente de asociar código integrado
  const [selectedProveedor, setSelectedProveedor] = useState("")
  const [codigoProveedor, setCodigoProveedor] = useState("")
  const [productosConDenominacion, setProductosConDenominacion] = useState([])
  const [loadingCodigos, setLoadingCodigos] = useState(false)
  const [messageAsociar, setMessageAsociar] = useState(null)
  const [errorAsociar, setErrorAsociar] = useState(null)
  const [costoAsociar, setCostoAsociar] = useState("")
  const [denominacionAsociar, setDenominacionAsociar] = useState("")
  const [cargandoCostoAsociar, setCargandoCostoAsociar] = useState(false)
  const [showSugeridos, setShowSugeridos] = useState(false)
  const [modoBusqueda, setModoBusqueda] = useState("codigo")

  // useEffect para cargar códigos del proveedor seleccionado
  useEffect(() => {
    if (selectedProveedor) {
      console.log('[useAsociacionCodigos] Fetching códigos para proveedor', selectedProveedor)
      setLoadingCodigos(true)
      fetch(`/api/productos/proveedor/${selectedProveedor}/codigos-lista/`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[useAsociacionCodigos] Respuesta códigos', { proveedor: selectedProveedor, total: (data.codigos || []).length })
          setProductosConDenominacion(data.productos || [])
          setLoadingCodigos(false)
        })
        .catch(() => {
          setLoadingCodigos(false)
        })
    } else {
      setProductosConDenominacion([])
    }
  }, [selectedProveedor])

  // Al cambiar de proveedor, ocultar errores previos de asociación
  useEffect(() => {
    setErrorAsociar(null)
  }, [selectedProveedor, setErrorAsociar])

  // Limpiar input al cambiar modo de búsqueda
  useEffect(() => {
    setCodigoProveedor("")
    setShowSugeridos(false)
  }, [modoBusqueda])

  // Consultar costo sugerido al cambiar proveedor o código
  useEffect(() => {
    if (selectedProveedor && codigoProveedor) {
      console.log('[useAsociacionCodigos] Consultando costo sugerido', { proveedor: selectedProveedor, codigo: codigoProveedor })
      setCargandoCostoAsociar(true)
      fetch(
        `/api/productos/precio-producto-proveedor/?proveedor_id=${selectedProveedor}&codigo_producto=${encodeURIComponent(codigoProveedor)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.precio !== undefined && data.precio !== null) {
            setCostoAsociar(data.precio)
            setDenominacionAsociar(data.denominacion || "")
          } else {
            setCostoAsociar("")
            setDenominacionAsociar("")
          }
          setCargandoCostoAsociar(false)
        })
        .catch(() => {
          setCostoAsociar("")
          setDenominacionAsociar("")
          setCargandoCostoAsociar(false)
        })
    } else {
      setCostoAsociar("")
      setDenominacionAsociar("")
    }
  }, [selectedProveedor, codigoProveedor])

  // Handler para asociar código de proveedor
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
      // Producto nuevo (incluye caso con ID temporal): NO llamar backend, persistir en estado local
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

    // En EDICIÓN: registrar en pendientes de edición y sincronizar el form
    if (isEdicion && form.id != null && String(form.id).length > 0) {
      // Validar contra los códigos ya asociados (guardados y pendientes)
      const codigosActuales = [
        ...(Array.isArray(form.stock_proveedores) ? form.stock_proveedores.map((sp) => sp.codigo_producto_proveedor).filter(Boolean) : []),
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
        return [...otros, { proveedor_id, codigo_producto_proveedor, costo, cantidad: 0 }]
      })
      // Actualizar form.stock_proveedores en el estado local para reflejar el nuevo código asociado
      const actualizado = (form.stock_proveedores || []).map((sp) =>
        String(sp.proveedor_id ?? (sp.proveedor?.id || sp.proveedor)) === String(proveedor_id)
          ? { ...sp, codigo_producto_proveedor, costo }
          : sp,
      )
      // Si no existe, agregarlo
      const existe = actualizado.some((sp) => String(sp.proveedor_id) === String(proveedor_id))
      updateForm({
        stock_proveedores: existe
          ? actualizado
          : [...actualizado, { proveedor_id, codigo_producto_proveedor, costo, cantidad: 0 }],
      })
      return { ok: true }
    }

    // Producto nuevo con id temporal: ya manejado arriba en la rama !isEdicion
    if (!isEdicion && form.id) {
      return { ok: true }
    }
    console.log("[handleAsociarCodigoPendiente] Fallback error")
    return { ok: false, error: "No se pudo asociar el código." }
  }

  // Función para filtrar productos sugeridos
  const filteredProductos = useMemo(() => {
    if (productosConDenominacion.length === 0) return []

    const term = codigoProveedor.trim().toLowerCase()
    const campo = modoBusqueda === "codigo" ? "codigo" : "denominacion"

    // Calcular puntuación por campo seleccionado
    const puntuados = productosConDenominacion
      .map((producto) => {
        const texto = String(producto[campo] || "").toLowerCase()
        let score = 0
        if (term.length === 0) {
          score = 0
        } else if (texto === term) {
          score = 1000
        } else if (texto.startsWith(term)) {
          score = 200 + (term.length / (texto.length || 1)) * 10
        } else if (texto.includes(term)) {
          score = 50
        }
        if (modoBusqueda === "denominacion" && !producto.denominacion) score = 0
        return { ...producto, score }
      })
      .filter((obj) => obj.score > 0 || term.length === 0)

    // Orden natural numérica + desc por score
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    puntuados.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return collator.compare(String(a.codigo), String(b.codigo))
    })

    return puntuados.slice(0, 8)
  }, [productosConDenominacion, codigoProveedor, modoBusqueda])

  // Validar si el código ingresado existe en la lista cargada del proveedor
  const codigoExisteEnLista = useMemo(() => {
    if (!selectedProveedor || !codigoProveedor) return false
    const term = String(codigoProveedor).trim().toLowerCase()
    return productosConDenominacion.some((p) => String(p.codigo || "").toLowerCase() === term)
  }, [selectedProveedor, codigoProveedor, productosConDenominacion])

  // Función para manejar la asociación de código
  const handleAsociarCodigoIntegrado = async () => {
    setErrorAsociar(null)
    setMessageAsociar(null)
    if (!selectedProveedor || !codigoProveedor) {
      setErrorAsociar("Debe seleccionar proveedor y código.")
      return
    }

    // Si el proveedor no tiene lista, bloquear
    if ((productosConDenominacion || []).length === 0) {
      setErrorAsociar("El proveedor seleccionado no tiene lista cargada o no se pudieron cargar sus códigos. No es posible asociar un código manualmente.")
      return
    }

    // Debe seleccionar un código que exista en la lista
    if (!codigoExisteEnLista) {
      setErrorAsociar("No se encontró el código en la lista del proveedor. Selecciónelo desde la tabla de sugerencias.")
      return
    }

    const resultado = await handleAsociarCodigoPendiente({
      proveedor_id: selectedProveedor,
      codigo_producto_proveedor: codigoProveedor,
      costo: costoAsociar,
    })

    if (resultado && resultado.ok) {
      // En modo nuevo, si el proveedor no está en proveedoresAgregados, agregarlo automáticamente
      if (!isEdicion && !stock?.id) {
        const proveedorId = Number(selectedProveedor)
        const yaExiste = proveedoresAgregados.some((pa) => pa.proveedor === proveedorId)
        
        if (!yaExiste) {
          setProveedoresAgregados((prev) => [
            ...prev,
            {
              proveedor: proveedorId,
              cantidad: 0,
              costo: Number(costoAsociar) || 0,
              codigo_producto_proveedor: codigoProveedor,
              pendiente: true,
            }
          ])
        } else {
          // Si ya existe, actualizar el costo y código
          setProveedoresAgregados((prev) =>
            prev.map((pa) =>
              pa.proveedor === proveedorId
                ? { ...pa, costo: Number(costoAsociar) || 0, codigo_producto_proveedor: codigoProveedor }
                : pa
            )
          )
        }
      }

      setMessageAsociar("¡Código de proveedor asociado correctamente!")
      // Limpiar formulario
      setSelectedProveedor("")
      setCodigoProveedor("")
      setCostoAsociar("")
      setDenominacionAsociar("")
      setTimeout(() => {
        setMessageAsociar(null)
      }, 2000)
    } else {
      setErrorAsociar(resultado && resultado.error ? resultado.error : "No se pudo asociar el código.")
      setTimeout(() => {
        setErrorAsociar(null)
      }, 3000)
    }
  }

  // Función para limpiar el formulario de asociación
  const handleCancelarAsociarCodigo = () => {
    setSelectedProveedor("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")
    setErrorAsociar(null)
    setMessageAsociar(null)
  }

  return {
    // Estados
    selectedProveedor,
    setSelectedProveedor,
    codigoProveedor,
    setCodigoProveedor,
    productosConDenominacion,
    loadingCodigos,
    messageAsociar,
    setMessageAsociar,
    errorAsociar,
    setErrorAsociar,
    costoAsociar,
    setCostoAsociar,
    denominacionAsociar,
    setDenominacionAsociar,
    cargandoCostoAsociar,
    showSugeridos,
    setShowSugeridos,
    modoBusqueda,
    setModoBusqueda,
    codigoExisteEnLista,
    
    // Handlers
    handleAsociarCodigoPendiente,
    handleAsociarCodigoIntegrado,
    handleCancelarAsociarCodigo,
    
    // Cálculos
    filteredProductos,
  }
}

export default useAsociacionCodigos
