"use client"

import { useState, useRef, useEffect } from "react"
import { formatearMoneda } from "./plantillasComprobantes/helpers"

const ComprobanteAsociadoTooltip = ({ documentos, titulo }) => {
  const [visible, setVisible] = useState(false)
  const tooltipRef = useRef(null)
  const iconRef = useRef(null)

  const toggleVisibilidad = (e) => {
    e.stopPropagation()
    setVisible(!visible)
  }

  const handleClickAfuera = (event) => {
    if (
      tooltipRef.current &&
      !tooltipRef.current.contains(event.target) &&
      iconRef.current &&
      !iconRef.current.contains(event.target)
    ) {
      setVisible(false)
    }
  }

  useEffect(() => {
    if (visible) {
      document.addEventListener("mousedown", handleClickAfuera)
    } else {
      document.removeEventListener("mousedown", handleClickAfuera)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickAfuera)
    }
  }, [visible])

  if (!documentos || documentos.length === 0) {
    return null
  }

  return (
    <div className="relative inline-block ml-2 align-middle">
      <button
        ref={iconRef}
        type="button"
        onClick={toggleVisibilidad}
        className="group flex items-center justify-center w-6 h-6 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 rounded-lg border border-slate-300/50 hover:from-orange-50 hover:to-orange-100 hover:text-orange-700 hover:border-orange-300/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 shadow-sm hover:shadow-md"
        aria-label={`Mostrar ${titulo} (${documentos.length})`}
      >
        <div className="flex items-center gap-1">
          <svg
            className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span className="text-xs font-bold font-mono">{documentos.length}</span>
        </div>
      </button>

      {visible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 w-64 left-full ml-2 -mt-2 bg-white rounded-lg shadow-2xl border border-slate-200/80"
          role="tooltip"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <h4 className="font-bold text-xs text-slate-800">{titulo}</h4>
              <span className="text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full font-mono">
                {documentos.length}
              </span>
            </div>
            <button
              onClick={() => setVisible(false)}
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

          {/* Content */}
          <div className="max-h-40 overflow-y-auto p-1">
            <div className="space-y-0.5">
              {documentos.map((doc, index) => {
                const esNotaCredito = doc.comprobante?.tipo?.toLowerCase().includes("nota de crédito")
                const totalStyle = esNotaCredito ? "text-red-700 font-bold" : "text-emerald-700 font-bold"
                const totalPrefijo = esNotaCredito ? "- " : ""

                return (
                  <div key={doc.ven_id || doc.id} className="group">
                    <div className="flex items-center justify-between p-2 bg-slate-50/50 hover:bg-slate-100/80 rounded transition-all duration-200 border border-transparent hover:border-slate-200/50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1 h-1 rounded-full bg-orange-500 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {doc.numero_formateado || `#${doc.ven_id || doc.id}`}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(doc.ven_fecha).toLocaleDateString("es-AR", {
                              timeZone: "UTC",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {doc.ven_total != null && (
                        <div className="text-right flex-shrink-0">
                          <span className={`${totalStyle} text-xs font-mono`}>
                            {totalPrefijo}${formatearMoneda(doc.ven_total)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Separador sutil entre elementos */}
                    {index < documentos.length - 1 && (
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-2 my-0.5"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ComprobanteAsociadoTooltip
