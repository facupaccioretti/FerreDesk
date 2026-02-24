"use client"

import { useState, useEffect, useCallback } from "react"

const UMBRAL_BUSQUEDA = 2
const DEBOUNCE_DELAY = 300

/**
 * Buscador reactivo de clientes: a partir de 2 caracteres busca en la API
 * y muestra un dropdown de resultados. Mismo patrón que BuscadorProducto.
 *
 * @param {function} onSelect - Callback al elegir un cliente: onSelect(cliente)
 * @param {boolean} disabled - Deshabilita el input
 * @param {string} placeholder - Placeholder del input
 * @param {string} className - Clases CSS del contenedor
 */
function BuscadorCliente({ onSelect, disabled = false, placeholder = "Buscar cliente...", className = "" }) {
  const [busqueda, setBusqueda] = useState("")
  const [sugerencias, setSugerencias] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const buscarClientes = useCallback(async (termino) => {
    if (termino.length < UMBRAL_BUSQUEDA) {
      setSugerencias([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const url = `/api/clientes/clientes/?search=${encodeURIComponent(termino)}`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Error en la búsqueda")
      const data = await res.json()
      const lista = data.results ?? (Array.isArray(data) ? data : [])
      setSugerencias(lista)
    } catch (err) {
      setError(err.message)
      setSugerencias([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda.length >= UMBRAL_BUSQUEDA) {
        buscarClientes(busqueda)
      } else {
        setSugerencias([])
      }
    }, DEBOUNCE_DELAY)
    return () => clearTimeout(timer)
  }, [busqueda, buscarClientes])

  useEffect(() => {
    if (sugerencias.length > 0 && !disabled) setShowDropdown(true)
  }, [sugerencias, disabled])

  const handleChange = (e) => {
    setBusqueda(e.target.value)
    setHighlighted(0)
  }

  const handleSelect = useCallback(
    (cliente) => {
      onSelect(cliente)
      setBusqueda("")
      setSugerencias([])
      setShowDropdown(false)
      setHighlighted(0)
    },
    [onSelect]
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return
      if (e.key === "Enter") {
        if (sugerencias.length > 0 && busqueda) {
          handleSelect(sugerencias[highlighted])
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (e.key === "ArrowDown") {
        setHighlighted((h) => Math.min(h + 1, sugerencias.length - 1))
      } else if (e.key === "ArrowUp") {
        setHighlighted((h) => Math.max(h - 1, 0))
      }
    },
    [disabled, sugerencias, busqueda, highlighted, handleSelect]
  )

  const handleFocus = useCallback(() => {
    if (sugerencias.length > 0 && !disabled) setShowDropdown(true)
  }, [sugerencias.length, disabled])

  const handleBlur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 150)
  }, [])

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={disabled ? "" : placeholder}
          className={`w-full px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 text-xs h-8 ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
          autoComplete="off"
          disabled={disabled}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
          </div>
        )}
      </div>

      {showDropdown && sugerencias.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-sm shadow-lg max-h-60 overflow-y-auto">
          {sugerencias.map((c, idx) => {
            const nombre = c.razon || c.fantasia || "Sin nombre"
            const cuit = c.cuit ? `CUIT: ${c.cuit}` : ""
            const isSelected = idx === highlighted
            return (
              <div
                key={c.id}
                className={`px-3 py-2 cursor-pointer text-xs hover:bg-orange-50 ${isSelected ? "bg-orange-100" : ""}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={() => handleSelect(c)}
                onMouseEnter={() => setHighlighted(idx)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-800 font-medium">{nombre}</span>
                  {cuit && <span className="text-slate-500 text-[10px]">{cuit}</span>}
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

export default BuscadorCliente
