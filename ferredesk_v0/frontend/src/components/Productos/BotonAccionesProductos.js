"use client"

import React, { useState, useRef, useEffect } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { Plus, FolderTree, RefreshCw, ChevronDown } from "lucide-react"

const BotonAccionesProductos = ({ onNuevoProducto, onGestionarFamilias, onActualizarListas }) => {
  const theme = useFerreDeskTheme()
  const [visible, setVisible] = useState(false)
  const dropdownRef = useRef(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setVisible(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const opciones = [
    {
      id: "nuevo_producto",
      label: "Nuevo Producto",
      icon: <Plus className="w-4 h-4" />,
      onClick: onNuevoProducto,
    },
    {
      id: "gestionar_familias",
      label: "Gestionar Familias",
      icon: <FolderTree className="w-4 h-4" />,
      onClick: onGestionarFamilias,
    },
    {
      id: "actualizar_listas",
      label: "Actualizar Listas",
      icon: <RefreshCw className="w-4 h-4" />,
      onClick: onActualizarListas,
    },
  ]

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Botón principal */}
      <button
        onClick={() => setVisible(!visible)}
        type="button"
        className={`${theme.botonPrimario} flex items-center gap-1.5 text-xs px-3 py-1 h-8`}
      >
        <Plus className="w-3 h-3" />
        <span>Acciones</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${visible ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {visible && (
        <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1" role="menu">
          {opciones.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              onClick={() => {
                opcion.onClick()
                setVisible(false)
              }}
              className="w-full px-3 py-2 text-left hover:bg-orange-500 hover:text-white flex items-center space-x-2 text-slate-700 transition-colors duration-150 group text-xs font-medium"
            >
              <div className="text-slate-400 group-hover:text-white transition-colors">
                {opcion.icon}
              </div>
              <span>{opcion.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default BotonAccionesProductos
