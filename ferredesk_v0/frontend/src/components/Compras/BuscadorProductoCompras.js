"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useProductoLookupCompra } from "../../hooks/useProductoLookupCompra"

const UMBRAL_BUSQUEDA = 2
const DEBOUNCE_DELAY = 300

function BuscadorProductoCompras({
  selectedProveedor,
  onSelect,
  disabled = false,
  readOnly = false,
  className = "",
  modoOrdenCompra = false,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const observabilidadRef = useRef({
    secuenciaId: 0,
    ultimoTermino: '',
    requestsEnSecuencia: 0,
  })
  const { buscarProductosProveedor } = useProductoLookupCompra({
    proveedorId: selectedProveedor?.id ?? null,
    modoOrdenCompra,
  })

  const registrarObservabilidadBusqueda = useCallback((payload) => {
    if (typeof window === 'undefined') return

    window.__ferredesk_pos_baseline__ = window.__ferredesk_pos_baseline__ || {}
    window.__ferredesk_pos_baseline__.busquedasCompras = window.__ferredesk_pos_baseline__.busquedasCompras || []

    const registro = {
      componente: 'BuscadorProductoCompras',
      tenant_host: window.location.host,
      timestamp: new Date().toISOString(),
      modo_orden_compra: modoOrdenCompra,
      proveedor_id: selectedProveedor?.id ?? null,
      ...payload,
    }

    window.__ferredesk_pos_baseline__.busquedasCompras.push(registro)
    window.__ferredesk_pos_baseline__.ultimaBusquedaCompras = registro

    if (window.__ferredesk_pos_baseline__.busquedasCompras.length > 100) {
      window.__ferredesk_pos_baseline__.busquedasCompras = window.__ferredesk_pos_baseline__.busquedasCompras.slice(-100)
    }

    console.info('[POS_BASELINE_SEARCH_COMPRAS]', registro)
  }, [modoOrdenCompra, selectedProveedor?.id])

  const buscarProductos = useCallback(async (termino) => {
    if (termino.length < UMBRAL_BUSQUEDA) {
      setSugerencias([])
      return
    }

    const terminoNormalizado = termino.trim().toLowerCase()
    if (observabilidadRef.current.ultimoTermino !== terminoNormalizado) {
      observabilidadRef.current.secuenciaId += 1
      observabilidadRef.current.ultimoTermino = terminoNormalizado
      observabilidadRef.current.requestsEnSecuencia = 0
    }
    observabilidadRef.current.requestsEnSecuencia += 1

    const secuenciaId = observabilidadRef.current.secuenciaId
    const requestNumero = observabilidadRef.current.requestsEnSecuencia
    const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now()

    setLoading(true)
    setError(null)

    try {
      if (!selectedProveedor?.id) {
        setSugerencias([])
        return
      }

      const sugs = await buscarProductosProveedor(termino, { limit: 20 })
      setSugerencias(sugs)
      registrarObservabilidadBusqueda({
        termino,
        secuencia_id: secuenciaId,
        request_en_secuencia: requestNumero,
        origen_datos: modoOrdenCompra ? 'hook_busqueda_orden_compra' : 'hook_busqueda_compra',
        cantidad_resultados: sugs.length,
        resultado: 'ok',
        duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
      })
    } catch (err) {
      setError(err.message)
      setSugerencias([])
      registrarObservabilidadBusqueda({
        termino,
        secuencia_id: secuenciaId,
        request_en_secuencia: requestNumero,
        cantidad_resultados: 0,
        resultado: 'error',
        error: err.message,
        duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
      })
    } finally {
      setLoading(false)
    }
  }, [buscarProductosProveedor, modoOrdenCompra, registrarObservabilidadBusqueda, selectedProveedor?.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda.length >= UMBRAL_BUSQUEDA) {
        buscarProductos(busqueda)
      } else {
        setSugerencias([])
      }
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(timer)
  }, [busqueda, buscarProductos])

  useEffect(() => {
    if (sugerencias.length > 0 && !disabled && !readOnly) {
      setShowDropdown(true)
    }
  }, [sugerencias, disabled, readOnly])

  useEffect(() => {
    setBusqueda('')
    setSugerencias([])
    setShowDropdown(false)
    setHighlighted(0)
    setError(null)
  }, [selectedProveedor?.id, modoOrdenCompra])

  const handleChange = (e) => {
    setBusqueda(e.target.value)
    setHighlighted(0)
  }

  const handleSelect = useCallback((producto) => {
    onSelect(producto)
    setBusqueda('')
    setSugerencias([])
    setShowDropdown(false)
    setHighlighted(0)
  }, [onSelect])

  const handleKeyDown = useCallback((e) => {
    if (disabled || readOnly) return

    if (e.key === 'Enter') {
      if (sugerencias.length > 0 && busqueda) {
        handleSelect(sugerencias[highlighted])
      }
      e.preventDefault()
      e.stopPropagation()
    } else if (e.key === 'ArrowDown') {
      setHighlighted((h) => Math.min(h + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      setHighlighted((h) => Math.max(h - 1, 0))
    }
  }, [busqueda, disabled, handleSelect, highlighted, readOnly, sugerencias])

  const handleFocus = useCallback(() => {
    if (sugerencias.length > 0 && !disabled && !readOnly) {
      setShowDropdown(true)
    }
  }, [sugerencias.length, disabled, readOnly])

  const handleBlur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 150)
  }, [])

  const handleMouseEnter = useCallback((idx) => {
    setHighlighted(idx)
  }, [])

  const handleMouseDown = useCallback((producto) => {
    handleSelect(producto)
  }, [handleSelect])

  const isDisabled = disabled || readOnly || !selectedProveedor?.id

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            isDisabled
              ? selectedProveedor?.id
                ? "Seleccione un proveedor primero"
                : "Buscar productos..."
              : modoOrdenCompra
                ? "Escriba al menos 2 caracteres para buscar productos..."
                : "Buscar productos del proveedor..."
          }
          className={`w-full px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 text-xs h-8 ${isDisabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
          autoComplete="off"
          disabled={isDisabled}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
          </div>
        )}
      </div>

      {showDropdown && sugerencias.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-sm shadow-lg max-h-60 overflow-y-auto">
          {sugerencias.map((p, idx) => {
            const isSelected = idx === highlighted
            return (
              <div
                key={p.id}
                className={`px-3 py-2 cursor-pointer text-xs hover:bg-orange-50 ${isSelected ? 'bg-orange-100' : ''}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={() => handleMouseDown(p)}
                onMouseEnter={() => handleMouseEnter(idx)}
              >
                <div className="flex items-center gap-1">
                  <span className="font-mono text-slate-600 min-w-[60px]">
                    {modoOrdenCompra ? p.codvta : (p.codigo_proveedor || p.codvta)}
                  </span>
                  <span className="text-slate-800 flex-1">{p.deno || p.nombre}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="absolute z-50 w-full mt-1 bg-red-50 border border-red-200 rounded-sm p-2 text-xs text-red-600">
          Error: {error}
        </div>
      )}
    </div>
  )
}

export default BuscadorProductoCompras
