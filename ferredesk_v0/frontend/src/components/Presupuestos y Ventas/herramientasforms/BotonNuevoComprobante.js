"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme'
import { IconFactura, IconCredito, IconPresupuesto } from '../../ComprobanteIcono'

const BotonNuevoComprobante = ({ onNuevoPresupuesto, onNuevaVenta, onNuevaNotaCredito, onNuevaModificacionContenido, onNuevaNotaDebito, onNuevaExtensionContenido }) => {
  const theme = useFerreDeskTheme()
  const [mostrarOpciones, setMostrarOpciones] = useState(false)
  const dropdownRef = useRef(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarOpciones(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const opciones = [
    {
      id: 'presupuesto',
      label: 'Presupuesto',
      icon: <IconPresupuesto />,
      onClick: () => {
        onNuevoPresupuesto()
        setMostrarOpciones(false)
      }
    },
    {
      id: 'nota_debito',
      label: 'Nota de Débito',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaNotaDebito && onNuevaNotaDebito()
        setMostrarOpciones(false)
      }
    },
    {
      id: 'extension_contenido',
      label: 'Extensión Contenido',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaExtensionContenido && onNuevaExtensionContenido()
        setMostrarOpciones(false)
      }
    },
    {
      id: 'venta',
      label: 'Venta',
      icon: <IconFactura />,
      onClick: () => {
        onNuevaVenta()
        setMostrarOpciones(false)
      }
    },
    {
      id: 'nota_credito',
      label: 'Nota de Crédito',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaNotaCredito()
        setMostrarOpciones(false)
      }
    },
    {
      id: 'modificacion_contenido',
      label: 'Modif. Contenido',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaModificacionContenido()
        setMostrarOpciones(false)
      }
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón principal */}
      <button
        onClick={() => setMostrarOpciones(!mostrarOpciones)}
        className={`${theme.botonPrimario} flex items-center gap-1 text-xs px-3 py-1 h-8`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Nuevo</span>
        <svg 
          className={`w-3 h-3 transition-transform duration-200 ${mostrarOpciones ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {mostrarOpciones && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          <div className="py-2">
            {opciones.map((opcion) => (
              <button
                key={opcion.id}
                onClick={opcion.onClick}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center space-x-3 text-slate-700 transition-colors duration-150"
              >
                <div className="text-slate-400">
                  {opcion.icon}
                </div>
                <span className="font-medium">{opcion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BotonNuevoComprobante
