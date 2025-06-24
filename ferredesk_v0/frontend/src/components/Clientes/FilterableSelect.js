"use client"

import React, { useState, useMemo, startTransition, useRef, useEffect } from "react"

// Componente reutilizable con búsqueda y opción de agregar
// Extraído sin modificaciones funcionales de ClientesManager.js

const FilterableSelect = ({ label, options, value, onChange, onAdd, placeholder, addLabel, name }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // Ref al contenedor para detectar clics afuera
  const contenedorRef = useRef(null)

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickFuera)
    return () => document.removeEventListener("mousedown", handleClickFuera)
  }, [])

  // Memoizamos el filtrado para evitar recomputar en cada render
  const filtered = useMemo(
    () => options.filter((opt) => opt.nombre.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  )

  // Opción actualmente seleccionada (para mostrar su nombre)
  const selected = options.find((opt) => String(opt.id) === String(value))

  return (
    <div className="mb-2 relative" ref={contenedorRef}>
      <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center justify-between">
        {label}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-2 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
          >
            Agregar
          </button>
        )}
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          placeholder={placeholder}
          value={selected ? selected.nombre : search}
          onFocus={() => {
            if (search.length >= 1) setOpen(true)
          }}
          onChange={(e) => {
            const texto = e.target.value
            startTransition(() => {
              setSearch(texto)
            })
            setOpen(texto.length >= 1)
            onChange({ target: { name, value: "" } })
          }}
        />
        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <div className="absolute z-10 bg-white border border-slate-300 rounded-lg w-full mt-1 max-h-40 overflow-auto shadow-lg">
            {filtered.length === 0 && <div className="px-3 py-2 text-slate-500 text-sm">Sin resultados</div>}
            {filtered.map((opt) => (
              <div
                key={opt.id}
                className={`px-3 py-2 cursor-pointer hover:bg-orange-50 text-sm transition-colors ${String(opt.id) === String(value) ? "bg-orange-100 font-semibold text-orange-800" : "text-slate-700"}`}
                onMouseDown={() => {
                  onChange({ target: { name, value: opt.id } })
                  setSearch(opt.nombre)
                  setOpen(false)
                }}
              >
                {opt.nombre}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(FilterableSelect); 