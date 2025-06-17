"use client"

import { useState, useRef, useEffect } from "react"
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from "./ComprobanteIcono"

// Utilidad para icono y nombre corto
const getComprobanteIconAndLabel = (tipo, nombre = "", letra = "") => {
  const n = (nombre || "").toLowerCase()
  if (n.includes("presupuesto")) return { icon: <IconPresupuesto />, label: "Presupuesto" }
  if (n.includes("venta")) return { icon: <IconVenta />, label: "Venta" }
  if (n.includes("factura")) return { icon: <IconFactura />, label: `Factura${letra ? " " + letra : ""}` }
  if (n.includes("nota de crédito interna")) return { icon: <IconCredito />, label: "N. Cred. Int." }
  if (n.includes("nota de crédito")) return { icon: <IconCredito />, label: "N. Cred." }
  if (n.includes("nota de débito")) return { icon: <IconCredito />, label: "N. Deb." }
  if (n.includes("recibo")) return { icon: <IconRecibo />, label: "Recibo" }
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
        className={`relative w-full bg-white border border-slate-300 rounded-xl shadow-sm pl-4 pr-12 py-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 hover:border-slate-400 hover:shadow-md ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 mr-3 shadow-sm ring-1 ring-slate-200/50">
            {icon}
          </span>
          <div>
            <span className="block truncate font-semibold text-slate-800">{label}</span>
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
        <div className="absolute z-20 mt-2 w-full bg-white/95 backdrop-blur-sm shadow-2xl max-h-80 rounded-xl overflow-hidden focus:outline-none border border-slate-200/50 ring-1 ring-slate-200/30">
          <ul className="py-2 divide-y divide-slate-100/50" role="listbox">
            {Object.entries(groups).map(([groupName, options]) => (
              <li key={groupName} className="px-2 py-2">
                <div className="px-3 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg mb-2 border border-slate-200/30">
                  {groupName}
                </div>
                <ul className="space-y-1">
                  {options.map((option) => {
                    const { icon: optIcon, label: optLabel } = getComprobanteIconAndLabel(
                      option.tipo,
                      option.label,
                      option.letra,
                    )
                    const isSelected = value === option.value
                    return (
                      <li
                        key={option.value}
                        className={`relative cursor-pointer select-none py-3 pl-4 pr-10 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/80 rounded-lg transition-all duration-200 ${isSelected ? "bg-gradient-to-r from-orange-100 to-orange-50 ring-1 ring-orange-200/50" : ""}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value)
                          setIsOpen(false)
                        }}
                      >
                        <div className="flex items-center">
                          <span
                            className={`flex items-center justify-center w-9 h-9 rounded-xl mr-3 shadow-sm transition-all duration-200 ${isSelected ? "bg-gradient-to-br from-orange-100 to-orange-200 ring-1 ring-orange-300/50" : "bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/50"}`}
                          >
                            {optIcon}
                          </span>
                          <div>
                            <span
                              className={`block truncate transition-all duration-200 ${isSelected ? "font-bold text-orange-800" : "font-medium text-slate-700"}`}
                            >
                              {optLabel}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-orange-600">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
