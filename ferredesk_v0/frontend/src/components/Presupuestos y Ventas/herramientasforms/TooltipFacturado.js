"use client"

import { formatearMoneda } from "./plantillasComprobantes/helpers"
import usePortalTooltip from "./usePortalTooltip"

const TITULO_TOOLTIP = "Factura relacionada"

/**
 * Formatea fecha para mostrar en el tooltip (soporta ISO string o Date).
 * @param {string|Date|null} fecha
 * @returns {string}
 */
function formatearFecha(fecha) {
  if (!fecha) return "—"
  const d = typeof fecha === "string" ? new Date(fecha) : fecha
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Tooltip para cotizaciones convertidas a factura.
 * Muestra número de factura, cuándo se facturó y usuario que facturó (auditoría).
 * Implementado igual que ComprobanteAsociadoTooltip (portal + trigger).
 */
const TooltipFacturado = ({ facturaInfo }) => {
  const { TooltipPortal, triggerProps } = usePortalTooltip({
    placement: "right",
    offset: 8,
  })

  if (!facturaInfo) return null

  const numero = facturaInfo.numero_formateado || `#${facturaInfo.ven_id || facturaInfo.id || "—"}`
  const fechaFacturacion = facturaInfo.fecha_conversion || facturaInfo.ven_fecha
  const usuario = facturaInfo.usuario_conversion || "—"

  return (
    <>
      <div className="inline-block ml-1 align-middle">
        <button
          {...triggerProps}
          type="button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 cursor-pointer"
          aria-label={`${TITULO_TOOLTIP}: ${numero}`}
        >
          Facturado
        </button>
      </div>

      <TooltipPortal
        className="w-64 bg-white rounded-lg shadow-2xl border border-slate-200/80"
        role="tooltip"
      >
        <div className="flex justify-between items-center p-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <h4 className="font-bold text-xs text-slate-800">{TITULO_TOOLTIP}</h4>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              triggerProps.onClick(e)
            }}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-all duration-150"
            aria-label="Cerrar tooltip"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between p-2 bg-slate-50/50 rounded border border-slate-200/50">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-medium mb-0.5">Nº factura</div>
              <span className="font-mono font-bold text-slate-800 text-sm">{numero}</span>
            </div>
            {facturaInfo.ven_total != null && (
              <div className="text-right flex-shrink-0">
                <span className="text-xs text-emerald-700 font-bold font-mono">
                  ${formatearMoneda(facturaInfo.ven_total)}
                </span>
              </div>
            )}
          </div>
          <div className="p-2 bg-slate-50/50 rounded border border-slate-200/50">
            <div className="text-xs text-slate-500 font-medium mb-0.5">Fecha de facturación</div>
            <span className="text-xs font-medium text-slate-800">{formatearFecha(fechaFacturacion)}</span>
          </div>
          <div className="p-2 bg-slate-50/50 rounded border border-slate-200/50">
            <div className="text-xs text-slate-500 font-medium mb-0.5">Facturado por</div>
            <span className="text-xs font-medium text-slate-800">{usuario}</span>
          </div>
        </div>
      </TooltipPortal>
    </>
  )
}

export default TooltipFacturado
