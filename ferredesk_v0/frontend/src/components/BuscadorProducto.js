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
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={() => { if (sugerencias.length > 0 && !disabled && !readOnly) setShowDropdown(true) }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={disabled || readOnly ? "" : "Buscar productos..."}
          className={`w-full px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 text-xs h-8 ${disabled || readOnly ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
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
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white shadow-2xl max-h-60 rounded-sm overflow-hidden focus:outline-none border border-slate-200/50 ring-1 ring-slate-200/30 text-xs">
          <ul className="py-1 space-y-0" role="listbox">
            {sugerencias.map((p, idx) => {
              const isSelected = highlighted === idx
              return (
                <li
                  key={p.id}
                  className={`relative cursor-pointer select-none py-1 pl-2 pr-2 rounded-sm transition-all duration-200 ${
                    isSelected
                      ? "bg-gradient-to-r from-orange-100 to-orange-50 ring-1 ring-orange-200/50"
                      : "hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/80"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={() => handleSelect(p)}
                  onMouseEnter={() => setHighlighted(idx)}
                >
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`font-bold text-xs ${isSelected ? 'text-orange-800' : 'text-slate-800'}`}>
                          {p.codvta}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-orange-700' : 'text-slate-600'}`}>
                        {p.deno || p.nombre}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default BuscadorProducto;
