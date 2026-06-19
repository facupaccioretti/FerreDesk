"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useProductoBusquedaLigera } from "../hooks/useProductoBusquedaLigera"

const UMBRAL_BUSQUEDA = 2
const DEBOUNCE_DELAY = 300

function BuscadorProducto({ onSelect, disabled = false, readOnly = false, className = "" }) {
  const [busqueda, setBusqueda] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const observabilidadRef = useRef({
    secuenciaId: 0,
    ultimoTermino: '',
    requestsEnSecuencia: 0,
    terminoDebouncedActivo: '',
    requestNumeroActivo: 0,
    inicioRequestMs: null,
    resultadoRegistradoPara: '',
  })

  const {
    resultados: sugerencias,
    cargando,
    actualizando,
    error,
    terminoDebounced,
  } = useProductoBusquedaLigera({
    termino: busqueda,
    debounceMs: DEBOUNCE_DELAY,
    enabled: !disabled && !readOnly,
  })

  const loading = cargando || actualizando

  const registrarObservabilidadBusqueda = useCallback((payload) => {
    if (typeof window === 'undefined') return

    window.__ferredesk_pos_baseline__ = window.__ferredesk_pos_baseline__ || {}
    window.__ferredesk_pos_baseline__.busquedas = window.__ferredesk_pos_baseline__.busquedas || []

    const registro = {
      componente: 'BuscadorProducto',
      tenant_host: window.location.host,
      timestamp: new Date().toISOString(),
      ...payload,
    }

    window.__ferredesk_pos_baseline__.busquedas.push(registro)
    window.__ferredesk_pos_baseline__.ultimaBusqueda = registro

    if (window.__ferredesk_pos_baseline__.busquedas.length > 100) {
      window.__ferredesk_pos_baseline__.busquedas = window.__ferredesk_pos_baseline__.busquedas.slice(-100)
    }

    console.info('[POS_BASELINE_SEARCH]', registro)
  }, [])

  useEffect(() => {
    if (sugerencias.length > 0 && !disabled && !readOnly) {
      setShowDropdown(true)
    }
  }, [sugerencias, disabled, readOnly])

  useEffect(() => {
    const terminoNormalizado = String(terminoDebounced || '').trim().toLowerCase()

    if (terminoNormalizado.length < UMBRAL_BUSQUEDA) {
      observabilidadRef.current.terminoDebouncedActivo = ''
      observabilidadRef.current.requestNumeroActivo = 0
      observabilidadRef.current.inicioRequestMs = null
      observabilidadRef.current.resultadoRegistradoPara = ''
      return
    }

    if (observabilidadRef.current.ultimoTermino !== terminoNormalizado) {
      observabilidadRef.current.secuenciaId += 1
      observabilidadRef.current.ultimoTermino = terminoNormalizado
      observabilidadRef.current.requestsEnSecuencia = 0
    }

    if (observabilidadRef.current.terminoDebouncedActivo !== terminoNormalizado) {
      observabilidadRef.current.requestsEnSecuencia += 1
      observabilidadRef.current.terminoDebouncedActivo = terminoNormalizado
      observabilidadRef.current.requestNumeroActivo = observabilidadRef.current.requestsEnSecuencia
      observabilidadRef.current.inicioRequestMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      observabilidadRef.current.resultadoRegistradoPara = ''
    }
  }, [terminoDebounced])

  useEffect(() => {
    const terminoNormalizado = String(terminoDebounced || '').trim()
    if (!terminoNormalizado || terminoNormalizado.length < UMBRAL_BUSQUEDA || loading) {
      return
    }

    const claveRegistro = terminoNormalizado.toLowerCase()
    if (observabilidadRef.current.resultadoRegistradoPara === claveRegistro) {
      return
    }

    const inicio = observabilidadRef.current.inicioRequestMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const payloadBase = {
      termino: terminoNormalizado,
      secuencia_id: observabilidadRef.current.secuenciaId,
      request_en_secuencia: observabilidadRef.current.requestNumeroActivo || observabilidadRef.current.requestsEnSecuencia,
      cantidad_resultados: sugerencias.length,
      duracion_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio),
    }

    if (error) {
      registrarObservabilidadBusqueda({
        ...payloadBase,
        resultado: 'error',
        error: error.message,
      })
    } else {
      registrarObservabilidadBusqueda({
        ...payloadBase,
        resultado: 'ok',
      })
    }

    observabilidadRef.current.resultadoRegistradoPara = claveRegistro
  }, [error, loading, registrarObservabilidadBusqueda, sugerencias.length, terminoDebounced])

  const handleChange = (e) => {
    setBusqueda(e.target.value)
    setHighlighted(0)
  }

  const handleSelect = useCallback((producto) => {
    onSelect(producto)
    setBusqueda('')
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

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={disabled || readOnly ? "" : "Buscar productos..."}
          className={`w-full px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 text-xs h-8 ${disabled || readOnly ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
          autoComplete="off"
          disabled={disabled || readOnly}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
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
                  <span className="font-mono text-slate-600 min-w-[60px]">{p.codvta}</span>
                  <span className="text-slate-800 flex-1">{p.deno}</span>
                  <span className="text-slate-500 text-xs">Stock: {p.stock_total ?? p.stock ?? 0}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-red-50 border border-red-200 rounded-sm p-2 text-xs text-red-600">
          Error: {error.message}
        </div>
      )}
    </div>
  )
}

export default BuscadorProducto
