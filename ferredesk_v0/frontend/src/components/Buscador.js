"use client"

import { useState, useRef, useEffect } from "react"

// ============================================================
// Buscador.js (componente genérico de autocompletado)
// ============================================================
// Este componente NO conoce el dominio (clientes, productos, etc.).
// Solo recibe una lista de ítems y funciones de ayuda para pintar y
// devolver la selección.  Se comporta similar a BuscadorProducto
// pero es 100% reutilizable.
//
// Props principales:
// - items:            Array<Object>       Lista completa de ítems para buscar.
// - camposBusqueda:   Array<string>       Nombres de propiedades donde buscar.
// - valor:            Object | null       Ítem actualmente seleccionado.
// - onSelect:         Function(item)      Callback cuando se selecciona.
// - obtenerEtiqueta:  Function(item)      Devuelve string para mostrar en input.
// - renderOpcion:     Function(item,idx,highlighted) -> JSX   Cómo pintar sugerencia.
// - placeholder:      string              Placeholder del input.
// - disabled:         boolean             Deshabilita interacción.
// - onInputChange:    Function(value)     Callback para cambiar el valor del input.
// - deshabilitarDropdown: boolean             Si true, no muestra la lista desplegable.
//
// Nota: Mantiene umbral mínimo (caracteres) mediante constante.
// ============================================================

const UMBRAL_BUSQUEDA_MINIMO = 2 // cantidad mínima de caracteres para filtrar
const CANTIDAD_MAX_SUGERENCIAS = 20 // límite visual para no desbordar lista

export default function Buscador({
  items = [],
  camposBusqueda = [],
  valor = null,
  onSelect = () => {},
  obtenerEtiqueta = (item) => (item ? String(item) : ""),
  renderOpcion,
  placeholder = "Buscar...",
  disabled = false,
  onInputChange,
  deshabilitarDropdown = false,
}) {
  // Estado local
  const [termino, setTermino] = useState("")
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)

  // Efecto: cada vez que cambia "termino", recalcular sugerencias
  useEffect(() => {
    if (deshabilitarDropdown) {
      setSugerencias([])
      setMostrarDropdown(false)
      return
    }

    if (termino.length >= UMBRAL_BUSQUEDA_MINIMO) {
      const lower = termino.toLowerCase()
      const filtradas = items.filter((item) =>
        camposBusqueda.some((campo) =>
          (item[campo] || "").toString().toLowerCase().includes(lower),
        ),
      )
      setSugerencias(filtradas.slice(0, CANTIDAD_MAX_SUGERENCIAS))
      setMostrarDropdown(true)
      setHighlighted(0)
    } else {
      setSugerencias([])
      setMostrarDropdown(false)
      setHighlighted(0)
    }
  }, [termino, items, camposBusqueda, deshabilitarDropdown])

  // Efecto: si cambia "valor" externo, reflejar etiqueta y cerrar dropdown
  useEffect(() => {
    if (valor) {
      setTermino(obtenerEtiqueta(valor))
      setSugerencias([])
      setMostrarDropdown(false)
    }
  }, [valor, obtenerEtiqueta])

  // Manejo de selección
  const manejarSeleccion = (item) => {
    onSelect(item)
    setTermino(obtenerEtiqueta(item))
    setSugerencias([])
    setMostrarDropdown(false)
    setHighlighted(0)
  }

  // Manejo de teclado dentro del input
  const manejarKeyDown = (e) => {
    if (!mostrarDropdown) return

    switch (e.key) {
      case "ArrowDown":
        setHighlighted((h) => Math.min(h + 1, sugerencias.length - 1))
        e.preventDefault()
        break
      case "ArrowUp":
        setHighlighted((h) => Math.max(h - 1, 0))
        e.preventDefault()
        break
      case "Enter":
        if (sugerencias.length > 0) {
          manejarSeleccion(sugerencias[highlighted])
        }
        e.preventDefault()
        break
      case "Escape":
        setMostrarDropdown(false)
        break
      default:
        break
    }
  }

  return (
    <div className="relative w-full" ref={inputRef}>
      <input
        type="text"
        value={termino}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setTermino(e.target.value)
          if (typeof onInputChange === "function") onInputChange(e.target.value)
        }}
        onFocus={() => {
          if (sugerencias.length > 0) setMostrarDropdown(true)
        }}
        onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
        onKeyDown={manejarKeyDown}
        className={`w-full px-4 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400 hover:shadow-md ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
        autoComplete="off"
      />

      {!deshabilitarDropdown && mostrarDropdown && sugerencias.length > 0 && (
        <ul className="absolute z-30 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl mt-2 w-full max-h-56 overflow-auto shadow-2xl ring-1 ring-slate-200/50">
          {sugerencias.map((item, idx) => (
            <li
              key={item.id || idx}
              className={`px-4 py-2 cursor-pointer transition-all duration-200 ${
                highlighted === idx
                  ? "bg-gradient-to-r from-orange-50 to-orange-100/80 text-orange-800"
                  : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 text-slate-700"
              } ${idx === 0 ? "rounded-t-xl" : ""} ${
                idx === sugerencias.length - 1 ? "rounded-b-xl" : ""
              }`}
              onMouseDown={() => manejarSeleccion(item)}
              onMouseEnter={() => setHighlighted(idx)}
            >
              {renderOpcion ? (
                renderOpcion(item, idx, highlighted === idx)
              ) : (
                <span>{obtenerEtiqueta(item)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
} 