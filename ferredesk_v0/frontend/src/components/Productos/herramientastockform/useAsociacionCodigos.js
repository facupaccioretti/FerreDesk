import { useState, useEffect, useMemo } from "react"

const MINIMO_BUSQUEDA = 2
const DEBOUNCE_MS = 250

const useAsociacionCodigos = ({
  stock,
  form,
  proveedores,
  updateForm,
  alert
}) => {
  const [selectedProveedor, setSelectedProveedor] = useState("")
  const [terminoBusqueda, setTerminoBusqueda] = useState("")
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

  useEffect(() => {
    setProductosConDenominacion([])
    setLoadingCodigos(false)
  }, [selectedProveedor])

  useEffect(() => {
    setErrorAsociar(null)
    setTerminoBusqueda("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")
    setShowSugeridos(false)
  }, [selectedProveedor])

  useEffect(() => {
    setTerminoBusqueda("")
    setCodigoProveedor("")
    setProductosConDenominacion([])
    setShowSugeridos(false)
  }, [modoBusqueda])

  useEffect(() => {
    if (!selectedProveedor) {
      setProductosConDenominacion([])
      setLoadingCodigos(false)
      return
    }

    const terminoNormalizado = terminoBusqueda.trim()
    if (terminoNormalizado.length < MINIMO_BUSQUEDA) {
      setProductosConDenominacion([])
      setShowSugeridos(false)
      setLoadingCodigos(false)
      return
    }

    if (codigoProveedor) {
      setShowSugeridos(false)
      setLoadingCodigos(false)
      return
    }

    let cancelado = false
    setLoadingCodigos(true)

    const timer = setTimeout(() => {
      fetch(
        `/api/productos/proveedor/${selectedProveedor}/codigos-lista/?q=${encodeURIComponent(terminoNormalizado)}&modo=${encodeURIComponent(modoBusqueda)}&limit=8`,
        { credentials: "include" }
      )
        .then((res) => (res.ok ? res.json() : { productos: [] }))
        .then((data) => {
          if (cancelado) return
          const resultados = Array.isArray(data.productos) ? data.productos : []
          setProductosConDenominacion(resultados)
          // Activar el dropdown cuando llegan resultados
          setShowSugeridos(resultados.length > 0)
          setLoadingCodigos(false)
        })
        .catch(() => {
          if (cancelado) return
          setProductosConDenominacion([])
          setShowSugeridos(false)
          setLoadingCodigos(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [selectedProveedor, terminoBusqueda, modoBusqueda, codigoProveedor])

  useEffect(() => {
    if (selectedProveedor && codigoProveedor) {
      setCargandoCostoAsociar(true)
      fetch(
        `/api/productos/precio-producto-proveedor/?proveedor_id=${selectedProveedor}&codigo_producto=${encodeURIComponent(codigoProveedor)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.precio !== undefined && data.precio !== null) {
            const baseCosto = parseFloat(data.precio) || 0
            const currImpuesto = parseFloat(form.impuesto_interno_porcentaje) || 0

            if (currImpuesto > 0) {
              const costoInflado = Number((baseCosto * (1 + (currImpuesto / 100))).toFixed(2))
              setCostoAsociar(costoInflado)
            } else {
              setCostoAsociar(baseCosto)
            }

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
      setCargandoCostoAsociar(false)
      setCostoAsociar("")
      setDenominacionAsociar("")
    }
  }, [selectedProveedor, codigoProveedor, form.impuesto_interno_porcentaje])

  useEffect(() => {
    if (modoBusqueda !== "codigo") return
    const exacto = productosConDenominacion.find(
      (producto) => String(producto.codigo || "").trim().toLowerCase() === terminoBusqueda.trim().toLowerCase()
    )
    setCodigoProveedor(exacto ? exacto.codigo : "")
  }, [productosConDenominacion, terminoBusqueda, modoBusqueda])

  const handleAsociarCodigoIntegrado = async () => {
    setErrorAsociar(null)
    setMessageAsociar(null)

    if (!selectedProveedor) {
      setErrorAsociar("Debe seleccionar un proveedor.")
      return
    }

    const pId = Number(selectedProveedor)
    const normalizedCodigo = String(codigoProveedor).trim()
    const normalizedCosto = parseFloat(String(costoAsociar).replace(",", ".")) || 0

    const yaAsociadoAotro = normalizedCodigo !== "" && (form.stock_proveedores || []).some((sp) =>
      String(sp.codigo_producto_proveedor || "").trim() === normalizedCodigo && String(sp.proveedor_id) !== String(pId)
    )

    if (yaAsociadoAotro) {
      setErrorAsociar("Este codigo ya se encuentra asociado a otro proveedor en este producto.")
      return
    }

    const actual = form.stock_proveedores || []
    const existeIndice = actual.findIndex((sp) => String(sp.proveedor_id) === String(pId))

    let nuevaLista
    if (existeIndice !== -1) {
      nuevaLista = actual.map((sp, idx) =>
        idx === existeIndice
          ? {
              ...sp,
              codigo_producto_proveedor: normalizedCodigo === "" ? sp.codigo_producto_proveedor || "" : normalizedCodigo,
              costo: normalizedCodigo === "" ? sp.costo || 0 : normalizedCosto,
              pendiente: true
            }
          : sp
      )
    } else {
      nuevaLista = [
        ...actual,
        {
          proveedor_id: pId,
          codigo_producto_proveedor: normalizedCodigo,
          costo: normalizedCosto,
          cantidad: 0,
          pendiente: true
        }
      ]
    }

    updateForm({ stock_proveedores: nuevaLista })

    setMessageAsociar("Proveedor asociado correctamente.")
    setSelectedProveedor("")
    setTerminoBusqueda("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")

    setTimeout(() => {
      setMessageAsociar(null)
    }, 2000)
  }

  const handleCancelarAsociarCodigo = () => {
    setSelectedProveedor("")
    setTerminoBusqueda("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")
    setErrorAsociar(null)
    setMessageAsociar(null)
  }

  const filteredProductos = useMemo(() => {
    return productosConDenominacion
  }, [productosConDenominacion])

  useEffect(() => {
    // El showSugeridos ya se activa directamente en el useEffect de busqueda
    // cuando llegan los resultados, para evitar timing issues entre effects
    if (terminoBusqueda.trim().length < MINIMO_BUSQUEDA) {
      setShowSugeridos(false)
    }
  }, [terminoBusqueda])

  return {
    selectedProveedor,
    setSelectedProveedor,
    terminoBusqueda,
    setTerminoBusqueda,
    codigoProveedor,
    setCodigoProveedor,
    productosConDenominacion,
    loadingCodigos,
    messageAsociar,
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
    filteredProductos,
    handleAsociarCodigoIntegrado,
    handleCancelarAsociarCodigo
  }
}

export default useAsociacionCodigos
