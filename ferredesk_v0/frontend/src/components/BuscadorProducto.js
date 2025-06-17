"use client"

// este buscador es el que se usa en la grilla de presupuestos y ventas
import { useState } from "react"

function BuscadorProducto({ productos, onSelect }) {
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
    <div className="relative w-full max-w-md">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={handleChange}
          onFocus={() => { if (sugerencias.length > 0) setShowDropdown(true) }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Buscar productos..."
          className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 hover:shadow-md"
          autoComplete="off"
          onKeyDown={e => {
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
        <ul className="absolute z-30 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl mt-2 w-full max-h-64 overflow-auto shadow-2xl ring-1 ring-slate-200/50">
          {sugerencias.map((p, idx) => (
            <li
              key={p.id}
              className={`px-4 py-3 cursor-pointer transition-all duration-200 ${
                highlighted === idx 
                  ? 'bg-gradient-to-r from-orange-50 to-orange-100/80 text-orange-800' 
                  : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 text-slate-700'
              } ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === sugerencias.length - 1 ? 'rounded-b-xl' : ''}`}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all duration-200 ${
                  highlighted === idx 
                    ? 'bg-gradient-to-br from-orange-100 to-orange-200 ring-1 ring-orange-300/50' 
                    : 'bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/50'
                }`}>
                  <svg className={`w-4 h-4 ${highlighted === idx ? 'text-orange-600' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
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
