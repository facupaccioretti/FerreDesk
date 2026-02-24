import { useState, useEffect, useMemo } from "react"

const useAsociacionCodigos = ({
  stock,
  form,
  proveedores,
  updateForm,
  alert
}) => {
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
      setLoadingCodigos(true)
      fetch(`/api/productos/proveedor/${selectedProveedor}/codigos-lista/`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
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

  // Limpiar error al cambiar de proveedor
  useEffect(() => {
    setErrorAsociar(null)
  }, [selectedProveedor])

  // Limpiar input al cambiar modo de búsqueda
  useEffect(() => {
    setCodigoProveedor("")
    setShowSugeridos(false)
  }, [modoBusqueda])

  // Consultar costo sugerido al cambiar proveedor o código
  useEffect(() => {
    if (selectedProveedor && codigoProveedor) {
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

  // Handler unificado para asociar código
  const handleAsociarCodigoIntegrado = async () => {
    setErrorAsociar(null)
    setMessageAsociar(null)

    if (!selectedProveedor || !codigoProveedor) {
      setErrorAsociar("Debe seleccionar proveedor y código.")
      return
    }

    const pId = Number(selectedProveedor)
    const normalizedCodigo = String(codigoProveedor).trim()
    const normalizedCosto = parseFloat(String(costoAsociar).replace(",", ".")) || 0

    // Validar duplicado en el propio formulario (fuente de verdad)
    const yaAsociadoAotro = (form.stock_proveedores || []).some(sp =>
      String(sp.codigo_producto_proveedor) === normalizedCodigo && String(sp.proveedor_id) !== String(pId)
    )

    if (yaAsociadoAotro) {
      setErrorAsociar("Este código ya se encuentra asociado a otro proveedor en este producto.")
      return
    }

    // Actualizar o Agregar en form.stock_proveedores
    const actual = form.stock_proveedores || []
    const existeIndice = actual.findIndex(sp => String(sp.proveedor_id) === String(pId))

    let nuevaLista
    if (existeIndice !== -1) {
      nuevaLista = actual.map((sp, idx) =>
        idx === existeIndice
          ? { ...sp, codigo_producto_proveedor: normalizedCodigo, costo: normalizedCosto, pendiente: true }
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

    setMessageAsociar("¡Código asociado correctamente!")
    // Limpiar formulario local modal
    setSelectedProveedor("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")

    setTimeout(() => {
      setMessageAsociar(null)
    }, 2000)
  }

  const handleCancelarAsociarCodigo = () => {
    setSelectedProveedor("")
    setCodigoProveedor("")
    setCostoAsociar("")
    setDenominacionAsociar("")
    setErrorAsociar(null)
    setMessageAsociar(null)
  }

  const filteredProductos = useMemo(() => {
    if (productosConDenominacion.length === 0) return []
    const term = codigoProveedor.trim().toLowerCase()
    const campo = modoBusqueda === "codigo" ? "codigo" : "denominacion"

    return productosConDenominacion
      .map((producto) => {
        const texto = String(producto[campo] || "").toLowerCase()
        let score = 0
        if (term.length === 0) score = 1
        else if (texto === term) score = 1000
        else if (texto.startsWith(term)) score = 200
        else if (texto.includes(term)) score = 50
        return { ...producto, score }
      })
      .filter((obj) => obj.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [productosConDenominacion, codigoProveedor, modoBusqueda])

  return {
    selectedProveedor,
    setSelectedProveedor,
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
