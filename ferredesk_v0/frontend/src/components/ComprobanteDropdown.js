"use client"

import { useState, useRef, useEffect } from "react"
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from "./ComprobanteIcono"

// Utilidad para icono y nombre corto
const getComprobanteIconAndLabel = (tipo, nombre = "", letra = "") => {
  const t = String(tipo || "").toLowerCase()
  const n = (nombre || "").toLowerCase()
  const sinAcentos = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const nClean = sinAcentos(n)
  if (nClean.includes("presupuesto")) return { icon: <IconPresupuesto />, label: "Presupuesto" }
  if (nClean.includes("venta")) return { icon: <IconVenta />, label: "Venta" }
  if (t === 'nota_credito' || t === 'nota_credito_interna' || nClean.includes('nota de credito')) {
    return { icon: <IconCredito />, label: "N. Cred." }
  }
  if (nClean.includes("nota de debito")) return { icon: <IconCredito />, label: "N. Deb." }
  if (nClean.includes("recibo")) return { icon: <IconRecibo />, label: "Recibo" }
  if (nClean.includes("factura")) return { icon: <IconFactura />, label: `Factura${letra ? " " + letra : ""}` }
  return { icon: <IconFactura />, label: nombre }
}

function groupByTipo(opciones) {
  const groups = {}
  ;(opciones || []).forEach((c) => {
    const group = (c.value || (c.label ? c.label.split(" ")[0] : "") || "").toUpperCase()
    if (!groups[group]) groups[group] = []
    groups[group].push(c)
  })
  return groups
}

export default function ComprobanteDropdown({ opciones = [], value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const selected = opciones.find((c) => c.value === value) || opciones[0] || {}
  const { icon, label } = getComprobanteIconAndLabel(selected.tipo, selected.label, selected.letra)
  const groups = groupByTipo(opciones)

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
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className={`relative w-full bg-white border border-slate-300 rounded-none shadow-sm pl-2 pr-6 py-1 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 hover:border-slate-400 text-xs h-8 ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="flex items-center justify-center w-4 h-4 rounded-none bg-gradient-to-br from-slate-100 to-slate-200 mr-1 shadow-sm ring-1 ring-slate-200/50">
            {icon}
          </span>
          <div>
            <span className="block truncate font-semibold text-slate-800 text-xs">{label}</span>
          </div>
        </div>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white/95 backdrop-blur-sm shadow-2xl max-h-80 rounded-none overflow-hidden focus:outline-none border border-slate-200/50 ring-1 ring-slate-200/30 text-xs">
          <ul className="py-1 space-y-0" role="listbox">
            {Object.entries(groups).map(([groupName, options]) => 
              options.map((option) => {
                const { icon: optIcon, label: optLabel } = getComprobanteIconAndLabel(
                  option.tipo,
                  option.label,
                  option.letra,
                )
                const isSelected = value === option.value
                return (
                  <li
                    key={option.value}
                    className={`relative cursor-pointer select-none py-1 pl-2 pr-6 mx-1 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/80 rounded-none transition-all duration-200 ${isSelected ? "bg-gradient-to-r from-orange-100 to-orange-50 ring-1 ring-orange-200/50" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                  >
                    <div className="flex items-center">
                      <span
                        className={`flex items-center justify-center w-4 h-4 rounded-none mr-1 shadow-sm transition-all duration-200 ${isSelected ? "bg-gradient-to-br from-orange-100 to-orange-200 ring-1 ring-orange-300/50" : "bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/50"}`}
                      >
                        {optIcon}
                      </span>
                      <div>
                        <span
                          className={`block truncate transition-all duration-200 text-xs ${isSelected ? "font-bold text-orange-800" : "font-medium text-slate-700"}`}
                        >
                          {optLabel}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-orange-600">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
