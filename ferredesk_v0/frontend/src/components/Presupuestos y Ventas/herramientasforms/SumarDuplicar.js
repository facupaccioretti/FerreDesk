"use client"

import { useState, useRef, useEffect } from "react"

const IconSumar = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const IconDuplicar = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
    />
  </svg>
)

const OPCIONES = [
  {
    value: "sumar",
    label: "Sumar cantidades",
    icon: <IconSumar />,
  },
  {
    value: "duplicar",
    label: "Crear duplicado",
    icon: <IconDuplicar />,
  },
]

/**
 * Componente para manejar la lógica de duplicación y suma de ítems
 * @param {Object} props
 * @param {string} props.autoSumarDuplicados - Valor actual de la acción por defecto ('sumar' o 'duplicar')
 * @param {Function} props.setAutoSumarDuplicados - Función para actualizar la acción por defecto
 */
const SumarDuplicar = ({ autoSumarDuplicados, setAutoSumarDuplicados, disabled }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const selected = OPCIONES.find((o) => o.value === autoSumarDuplicados) || OPCIONES[0]

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Acción por defecto al cargar duplicado
      </label>
      <button
        type="button"
        className={`relative w-full bg-white border border-slate-300 rounded-lg shadow-sm pl-3 pr-8 py-2 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 hover:border-slate-400 hover:shadow-md text-sm ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 mr-2 shadow-sm ring-1 ring-slate-200/50">
            {selected.icon}
          </span>
          <div>
            <span className="block truncate font-semibold text-slate-800">{selected.label}</span>
          </div>
        </div>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white shadow-2xl max-h-60 rounded-lg overflow-hidden focus:outline-none border border-slate-200/50 ring-1 ring-slate-200/30 text-sm">
          <ul className="py-1 space-y-1" role="listbox">
            {OPCIONES.map((option) => {
              const isSelected = autoSumarDuplicados === option.value
              return (
                <li
                  key={option.value}
                  className={`relative cursor-pointer select-none py-2 pl-3 pr-8 rounded-lg transition-all duration-200 ${
                    isSelected
                      ? "bg-gradient-to-r from-orange-100 to-orange-50 ring-1 ring-orange-200/50"
                      : "hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/80"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setAutoSumarDuplicados(option.value)
                    setIsOpen(false)
                  }}
                >
                  <div className="flex items-center">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-lg mr-2 shadow-sm transition-all duration-200 ${
                        isSelected
                          ? "bg-gradient-to-br from-orange-100 to-orange-200 ring-1 ring-orange-300/50"
                          : "bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/50"
                      }`}
                    >
                      {option.icon}
                    </span>
                    <div>
                      <span
                        className={`block truncate transition-all duration-200 ${
                          isSelected ? "font-bold text-orange-800" : "font-medium text-slate-700"
                        }`}
                      >
                        {option.label}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-orange-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SumarDuplicar;
