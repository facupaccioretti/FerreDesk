"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"

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

const AsociarCodigoProveedorModal = ({
  open,
  onClose,
  producto,
  productoId,
  proveedores,
  onAsociarCodigoPendiente,
}) => {
  const [selectedProveedor, setSelectedProveedor] = useState("")
  const [codigoProveedor, setCodigoProveedor] = useState("")
  const [codigosSugeridos, setCodigosSugeridos] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [costo, setCosto] = useState("")
  const [cargandoCosto, setCargandoCosto] = useState(false)
  const [showSugeridos, setShowSugeridos] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedProveedor("")
      setCodigoProveedor("")
      setCodigosSugeridos([])
      setMessage(null)
      setError(null)
      setCosto("")
      setShowSugeridos(false)
    }
  }, [open])

  useEffect(() => {
    if (selectedProveedor) {
      console.log('[Modal] Fetching códigos para proveedor', selectedProveedor)
      setLoading(true)
      fetch(`/api/productos/proveedor/${selectedProveedor}/codigos-lista/`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('[Modal] Respuesta códigos', { proveedor: selectedProveedor, total: (data.codigos || []).length })
          setCodigosSugeridos(data.codigos || [])
          setLoading(false)
        })
        .catch(() => {
          setCodigosSugeridos([])
          setLoading(false)
        })
    } else {
      setCodigosSugeridos([])
    }
  }, [selectedProveedor])

  // Consultar costo sugerido al cambiar proveedor o código
  useEffect(() => {
    if (selectedProveedor && codigoProveedor) {
      console.log('[Modal] Consultando costo sugerido', { proveedor: selectedProveedor, codigo: codigoProveedor })
      setCargandoCosto(true)
      fetch(
        `/api/productos/precio-producto-proveedor/?proveedor_id=${selectedProveedor}&codigo_producto=${encodeURIComponent(codigoProveedor)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.precio !== undefined && data.precio !== null) {
            setCosto(data.precio)
          } else {
            setCosto("")
          }
          setCargandoCosto(false)
        })
        .catch(() => {
          setCosto("")
          setCargandoCosto(false)
        })
    } else {
      setCosto("")
    }
  }, [selectedProveedor, codigoProveedor])

  const handleAsociar = async () => {
    setError(null)
    setMessage(null)
    if (!selectedProveedor || !codigoProveedor) {
      setError("Debe seleccionar proveedor y código.")
      return
    }
    setLoading(true)

    if (onAsociarCodigoPendiente) {
      const resultado = await onAsociarCodigoPendiente({
        proveedor_id: selectedProveedor,
        codigo_producto_proveedor: codigoProveedor,
        costo,
      })

      if (resultado && resultado.ok) {
        setMessage("¡Código de proveedor asociado correctamente!")
        setLoading(false)
        setTimeout(() => {
          onClose()
        }, 800)
        return
      } else {
        setError(resultado && resultado.error ? resultado.error : "No se pudo asociar el código.")
        setLoading(false)
        return
      }
    }

    try {
      const csrftoken = getCookie("csrftoken")
      const res = await fetch("/api/productos/asociar-codigo-proveedor/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken,
        },
        credentials: "include",
        body: JSON.stringify({
          stock_id: productoId,
          proveedor_id: selectedProveedor,
          codigo_producto_proveedor: codigoProveedor,
          costo: costo !== "" ? costo : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al asociar")
      setMessage("¡Código de proveedor asociado correctamente!")
      setLoading(false)
      setTimeout(() => {
        onClose()
      }, 800)
    } catch (err) {
      setError(err.message || "Error al asociar")
      setLoading(false)
      setTimeout(() => {
        onClose()
      }, 1200)
    }
  }

  // Memoizar el filtrado para evitar cálculos costosos en cada render
  const filteredCodigos = useMemo(() => {
    if (codigosSugeridos.length === 0) return []

    const term = codigoProveedor.trim().toLowerCase()

    // Calcular puntuación por código
    const puntuados = codigosSugeridos
      .map((codigo) => {
        const texto = String(codigo).toLowerCase()
        let score = 0
        if (term.length === 0) {
          // Sin texto de búsqueda: score por orden original
          score = 0
        } else if (texto === term) {
          score = 1000
        } else if (texto.startsWith(term)) {
          score = 200 + (term.length / texto.length) * 10 // pequeño ajuste por proximidad de longitud
        } else if (texto.includes(term)) {
          score = 50
        }
        return { codigo, score }
      })
      .filter((obj) => obj.score > 0 || term.length === 0)

    // Orden natural numérica + desc por score
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    puntuados.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return collator.compare(String(a.codigo), String(b.codigo))
    })

    const resultado = puntuados.slice(0, 8).map((obj) => obj.codigo)
    return resultado
  }, [codigosSugeridos, codigoProveedor])

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Fondo oscuro */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative border border-slate-200 text-left">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">Asociar Código</h2>
                      <p className="text-sm text-slate-600">Vincular producto con proveedor</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Mensajes */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {message}
                  </div>
                )}

                {/* Información del producto */}
                <div className="bg-gradient-to-r from-slate-50 to-orange-50/30 rounded-lg p-3 mb-4 border border-slate-200/50">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">Producto</span>
                  </div>
                  <p className="text-slate-800 font-medium">{producto ? `${producto.deno}` : "No disponible"}</p>
                  <p className="text-xs text-slate-600">
                    Código: {producto?.codcom || producto?.codvta || producto?.id || "N/A"}
                  </p>
                </div>

                {/* Formulario */}
                <div className="space-y-4">
                  {/* Proveedor */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <svg className="w-4 h-4 inline mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-2-5.5v3m0 0v3m0-3h3m-3 0h-3"
                        />
                      </svg>
                      Proveedor
                    </label>
                    <select
                      value={selectedProveedor}
                      onChange={(e) => setSelectedProveedor(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                    >
                      <option value="">Seleccione un proveedor</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.razon}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Código del proveedor */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <svg className="w-4 h-4 inline mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                        />
                      </svg>
                      Código del proveedor
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={codigoProveedor}
                        onChange={(e) => {
                          setCodigoProveedor(e.target.value)
                          setShowSugeridos(e.target.value.length > 0 && codigosSugeridos.length > 0)
                        }}
                        onFocus={() => setShowSugeridos(codigoProveedor.length > 0 && codigosSugeridos.length > 0)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        placeholder="Ingrese el código del proveedor"
                        disabled={loading || !selectedProveedor}
                      />
                      {codigosSugeridos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowSugeridos(!showSugeridos)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${showSugeridos ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Dropdown de sugerencias */}
                    {showSugeridos && filteredCodigos.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCodigos.map((codigo, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setCodigoProveedor(codigo)
                              setShowSugeridos(false)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-orange-50 hover:text-orange-700 transition-colors text-sm border-b border-slate-100 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                                />
                              </svg>
                              {codigo}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {loading && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                        <div className="w-3 h-3 border border-slate-300 border-t-orange-500 rounded-full animate-spin"></div>
                        Cargando códigos...
                      </div>
                    )}
                  </div>

                  {/* Costo sugerido */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <svg className="w-4 h-4 inline mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                      Costo sugerido
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={costo ? `$${costo}` : ""}
                        readOnly
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 cursor-not-allowed"
                        placeholder="Se calculará automáticamente"
                      />
                      {cargandoCosto && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <div className="w-4 h-4 border border-slate-300 border-t-orange-500 rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    {costo && <p className="text-xs text-green-600 mt-1">✓ Precio encontrado en lista del proveedor</p>}
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors font-medium"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAsociar}
                    disabled={loading || !selectedProveedor || !codigoProveedor}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                        Asociando...
                      </div>
                    ) : (
                      "Asociar Código"
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default AsociarCodigoProveedorModal
