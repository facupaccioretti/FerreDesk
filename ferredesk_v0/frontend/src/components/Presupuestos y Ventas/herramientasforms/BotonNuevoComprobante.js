"use client"

import React from 'react'
import { useFerreDeskTheme } from '../../../hooks/useFerreDeskTheme'
import { IconFactura, IconCredito, IconPresupuesto } from '../../ComprobanteIcono'
import usePortalTooltip from './usePortalTooltip'

const BotonNuevoComprobante = ({ onNuevoPresupuesto, onNuevaVenta, onNuevaNotaCredito, onNuevaModificacionContenido, onNuevaNotaDebito, onNuevaExtensionContenido }) => {
  const theme = useFerreDeskTheme()
  
  // Hook para manejar el portal del dropdown
  const { visible, TooltipPortal, triggerProps } = usePortalTooltip({
    placement: 'bottom', // El dropdown aparece debajo del botón
    offset: 8
  })

  const opciones = [
    {
      id: 'presupuesto',
      label: 'Presupuesto',
      icon: <IconPresupuesto />,
      onClick: () => {
        onNuevoPresupuesto()
      }
    },
    {
      id: 'nota_debito',
      label: 'Nota de Débito',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaNotaDebito && onNuevaNotaDebito()
      }
    },
    {
      id: 'extension_contenido',
      label: 'Extensión Contenido',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaExtensionContenido && onNuevaExtensionContenido()
      }
    },
    {
      id: 'venta',
      label: 'Venta',
      icon: <IconFactura />,
      onClick: () => {
        onNuevaVenta()
      }
    },
    {
      id: 'nota_credito',
      label: 'Nota de Crédito',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaNotaCredito()
      }
    },
    {
      id: 'modificacion_contenido',
      label: 'Modif. Contenido',
      icon: <IconCredito />,
      onClick: () => {
        onNuevaModificacionContenido()
      }
    }
  ]

  return (
    <>
      {/* Botón principal */}
      <button
        {...triggerProps}
        className={`${theme.botonPrimario} flex items-center gap-1 text-xs px-3 py-1 h-8`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Nuevo</span>
        <svg 
          className={`w-3 h-3 transition-transform duration-200 ${visible ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Portal del dropdown */}
      <TooltipPortal
        className="w-48 bg-white rounded-lg shadow-lg border border-slate-200"
        role="menu"
      >
        <div className="py-2">
          {opciones.map((opcion) => (
            <button
              key={opcion.id}
              onClick={(e) => {
                e.stopPropagation()
                opcion.onClick()
                triggerProps.onClick(e) // Cierra el dropdown después de la acción
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center space-x-3 text-slate-700 transition-colors duration-150"
            >
              <div className="text-slate-400">
                {opcion.icon}
              </div>
              <span className="font-medium">{opcion.label}</span>
            </button>
          ))}
        </div>
      </TooltipPortal>
    </>
  )
}

export default BotonNuevoComprobante
