"use client"

// este buscador es el que se usa en la grilla de presupuestos y ventas
import { useState } from "react"

function BuscadorProducto({ productos, onSelect, disabled = false, readOnly = false, className = "" }) {
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  // Filtrar productos a partir de 2 caracteres
  const handleChange = (e) => {
    const value = e.target.value
    setBusqueda(value)
    if (value.length >= 2) {
      const lower = value.toLowerCase()
      const sugs = productos.filter(
        p =>
          (p.codvta || '').toLowerCase().includes(lower) ||
          (p.codcom || '').toLowerCase().includes(lower) ||
          (p.deno || p.nombre || '').toLowerCase().includes(lower)
      )
      setSugerencias(sugs)
      setShowDropdown(true)
      setHighlighted(0)
    } else {
      setSugerencias([])
      setShowDropdown(false)
      setHighlighted(0)
    }
  }

  const handleSelect = (producto) => {
    onSelect(producto)
    setBusqueda('')
    setSugerencias([])
    setShowDropdown(false)
    setHighlighted(0)
  }

  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={() => { if (sugerencias.length > 0 && !disabled && !readOnly) setShowDropdown(true) }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={disabled || readOnly ? "" : "Buscar productos..."}
          className={`w-full px-4 py-2 border border-slate-300 rounded-none bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 hover:shadow-md ${disabled || readOnly ? "opacity-50 cursor-not-allowed bg-slate-100" : ""}`}
          autoComplete="off"
          disabled={disabled || readOnly}
          onKeyDown={e => {
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
          }}
        />
      </div>
      
      {showDropdown && sugerencias.length > 0 && (
        <ul className="absolute z-30 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-none mt-2 w-full max-h-40 overflow-auto shadow-2xl ring-1 ring-slate-200/50">
          {sugerencias.map((p, idx) => (
            <li
              key={p.id}
              className={`px-4 py-2 cursor-pointer transition-all duration-200 ${
                highlighted === idx 
                  ? 'bg-gradient-to-r from-orange-50 to-orange-100/80 text-orange-800' 
                  : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 text-slate-700'
              } ${idx === 0 ? 'rounded-t-none' : ''} ${idx === sugerencias.length - 1 ? 'rounded-b-none' : ''}`}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${highlighted === idx ? 'text-orange-800' : 'text-slate-800'}`}>
                      {p.codvta || p.codcom}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      highlighted === idx 
                        ? 'bg-orange-200/50 text-orange-700' 
                        : 'bg-slate-200/50 text-slate-600'
                    }`}>
                      PROD
                    </span>
                  </div>
                  <p className={`text-sm truncate mt-1 ${highlighted === idx ? 'text-orange-700' : 'text-slate-600'}`}>
                    {p.deno || p.nombre}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BuscadorProducto;
