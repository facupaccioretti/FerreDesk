"use client"

import React, { useState } from "react"

// Componente reutilizable con búsqueda y opción de agregar
// Extraído sin modificaciones funcionales de ClientesManager.js

const FilterableSelect = ({ label, options, value, onChange, onAdd, placeholder, addLabel, name }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // Filtra las opciones según el término ingresado
  const filtered = options.filter((opt) => opt.nombre.toLowerCase().includes(search.toLowerCase()))

  // Opción actualmente seleccionada (para mostrar su nombre)
  const selected = options.find((opt) => String(opt.id) === String(value))

  return (
    <div className="mb-2 relative">
      <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center justify-between">
        {label}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-2 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
          >
            {addLabel}
          </button>
        )}
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          placeholder={placeholder}
          value={selected ? selected.nombre : search}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
            // Al escribir, limpiamos el valor seleccionado para permitir nueva selección
            onChange({ target: { name, value: "" } })
          }}
        />
        {/* Dropdown */}
        {open && (
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

export default FilterableSelect 