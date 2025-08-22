"use client"

import { useState, useEffect, useCallback } from "react"

const UMBRAL_BUSQUEDA = 2 // Mínimo de caracteres para iniciar la búsqueda
const DEBOUNCE_DELAY = 300 // Tiempo de espera en ms después de teclear

function BuscadorProducto({ onSelect, disabled = false, readOnly = false, className = "" }) {
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const buscarProductos = useCallback(async (termino) => {
    if (termino.length < UMBRAL_BUSQUEDA) {
      setSugerencias([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const url = `/api/productos/stock/?search=${encodeURIComponent(termino)}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Error en la búsqueda')
      const data = await res.json()
      setSugerencias(data.results || [])
    } catch (err) {
      setError(err.message)
      setSugerencias([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce para evitar muchas llamadas a la API
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

  // Mostrar dropdown cuando se cargan sugerencias y el input tiene focus
  useEffect(() => {
    if (sugerencias.length > 0 && !disabled && !readOnly) {
      setShowDropdown(true)
    }
  }, [sugerencias, disabled, readOnly])

  const handleChange = (e) => {
    const value = e.target.value
    setBusqueda(value)
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
    if (disabled || readOnly) return;
    
    if (e.key === 'Enter') {
      if (sugerencias.length > 0 && busqueda) {
        handleSelect(sugerencias[highlighted])
        e.preventDefault()
        e.stopPropagation()
      } else {
        e.preventDefault()
        e.stopPropagation()
      }
    } else if (e.key === 'ArrowDown') {
      setHighlighted(h => Math.min(h + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      setHighlighted(h => Math.max(h - 1, 0))
    }
  }, [disabled, readOnly, sugerencias, busqueda, highlighted, handleSelect])

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
                  <span className="text-slate-500 text-xs">Stock: {p.stock || 0}</span>
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

export default BuscadorProducto
