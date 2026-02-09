"use client"

import { BotonEditar, BotonEliminar, BotonDesactivar, BotonGenerarPDF, BotonConvertir, BotonVerDetalle, BotonNotaCredito, BotonImprimir, BotonMarcarRechazado, BotonEndosar, BotonDepositar, BotonReactivar } from "../../Botones"
import usePortalTooltip from "./usePortalTooltip"

/**
 * Componente genérico para mostrar un menú de acciones con botón de 3 puntos
 * @param {Object} props - Props del componente
 * @param {Array} props.botones - Array de objetos con { componente, onClick, titulo, disabled }
 * @returns {JSX.Element} - Botón de 3 puntos con menú de acciones
 */
const AccionesMenu = ({
  botones = [],
}) => {
  // Hook para manejar el portal del tooltip
  const { TooltipPortal, triggerProps } = usePortalTooltip({
    placement: 'bottom', // El menú aparece debajo del botón
    offset: 8
  })

  if (botones.length === 0) {
    return null
  }

  return (
    <>
      {/* Botón trigger */}
      <button
        {...triggerProps}
        type="button"
        className="group flex items-center justify-center w-6 h-6 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        aria-label="Mostrar acciones"
      >
        <svg
          className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      </button>

      {/* Portal del menú */}
      <TooltipPortal
        className="w-44 bg-white rounded-lg shadow-2xl border border-slate-200/80"
        role="menu"
      >
        {/* Content */}
        <div className="py-1">
          <div className="space-y-0">
            {botones.map((boton, index) => {
              const ComponenteBoton = boton.componente
              return (
                <div key={index} className="group">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      boton.onClick()
                      triggerProps.onClick(e) // Cierra el tooltip después de la acción
                    }}
                    disabled={boton.disabled}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 bg-slate-50/50 hover:bg-slate-100/80 transition-all duration-200 border border-transparent hover:border-slate-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={boton.titulo}
                  >
                    <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                      <ComponenteBoton 
                        onClick={() => {}} // El onClick se maneja en el botón padre
                        disabled={boton.disabled}
                        className={`!p-0 !m-0 [&>svg]:w-3.5 [&>svg]:h-3.5 ${
                          boton.componente === BotonEditar ? 'text-blue-500' :
                          boton.componente === BotonConvertir ? 'text-violet-500' :
                          boton.componente === BotonEliminar ? 'text-red-500' :
                          boton.componente === BotonGenerarPDF ? 'text-red-500' :
                          boton.componente === BotonVerDetalle ? 'text-slate-600' :
                          boton.componente === BotonNotaCredito ? 'text-orange-500' :
                          boton.componente === BotonImprimir ? 'text-slate-600' :
                          boton.componente === BotonDesactivar ? 'text-slate-500' :
                          boton.componente === BotonMarcarRechazado ? 'text-red-500' :
                          boton.componente === BotonEndosar ? 'text-indigo-500' :
                          boton.componente === BotonDepositar ? 'text-orange-500' :
                          boton.componente === BotonReactivar ? 'text-green-500' :
                          'text-slate-600'
                        }`}
                      />
                    </div>
                    <span className="text-xs text-slate-700 font-medium text-left leading-tight">
                      {boton.titulo}
                    </span>
                  </button>

                  {/* Separador sutil entre elementos */}
                  {index < botones.length - 1 && (
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-2.5"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </TooltipPortal>
    </>
  )
}

export default AccionesMenu
