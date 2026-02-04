"use client"

import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal Cierre X: resumen de la sesión en solo lectura (no cierra la caja).
 */
const ModalCierreX = ({ sesion, resumen, onCerrar }) => {
  const theme = useFerreDeskTheme()

  const formatMoney = (value) => {
    const num = parseFloat(value) || 0
    return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const hayExcedentes =
    parseFloat(resumen?.excedente_no_facturado_propina) > 0 ||
    parseFloat(resumen?.vuelto_pendiente) > 0
  const saldoTeorico = parseFloat(resumen?.saldo_teorico_efectivo) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] mx-2 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.primario} px-4 py-2.5 flex-shrink-0`}>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Cierre X
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Resumen de la sesión</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">Saldo inicial:</span>
                <span className="ml-1 font-medium text-slate-700">${formatMoney(resumen?.saldo_inicial)}</span>
              </div>
              <div>
                <span className="text-slate-500">Ingresos manuales:</span>
                <span className="ml-1 font-medium text-green-600">+${formatMoney(resumen?.total_ingresos_manuales)}</span>
              </div>
              <div>
                <span className="text-slate-500">Egresos manuales:</span>
                <span className="ml-1 font-medium text-red-600">−${formatMoney(resumen?.total_egresos_manuales)}</span>
              </div>
              {resumen?.cantidad_ventas !== undefined && (
                <div>
                  <span className="text-slate-500">Comprobantes:</span>
                  <span className="ml-1 font-medium text-slate-700">{resumen.cantidad_ventas}</span>
                </div>
              )}
              {resumen?.total_ventas !== undefined && (
                <div>
                  <span className="text-slate-500">Total ventas:</span>
                  <span className="ml-1 font-medium text-slate-700">${formatMoney(resumen.total_ventas)}</span>
                </div>
              )}
              {hayExcedentes && (
                <>
                  {parseFloat(resumen?.excedente_no_facturado_propina) > 0 && (
                    <div>
                      <span className="text-slate-500">Propina/redondeo:</span>
                      <span className="ml-1 font-medium text-slate-700">${formatMoney(resumen.excedente_no_facturado_propina)}</span>
                    </div>
                  )}
                  {parseFloat(resumen?.vuelto_pendiente) > 0 && (
                    <div>
                      <span className="text-slate-500">Vuelto pend.:</span>
                      <span className="ml-1 font-medium text-slate-700">${formatMoney(resumen.vuelto_pendiente)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="col-span-2 pt-1.5 mt-1 border-t border-slate-200">
                <span className="text-slate-700 font-medium">Saldo teórico (efectivo):</span>
                <span className="ml-1 font-bold text-amber-600">${formatMoney(saldoTeorico)}</span>
              </div>
            </div>
          </div>

          {resumen?.totales_por_metodo?.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">Cobros por método</h4>
              <ul className="space-y-1 text-xs">
                {resumen.totales_por_metodo.map((item, index) => (
                  <li key={index} className="flex justify-between">
                    <span className="text-slate-600">{item.metodo_pago__nombre}</span>
                    <span className="font-medium text-slate-800">${formatMoney(item.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 pt-2 border-t border-slate-200 flex-shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            className={`w-full py-2 text-sm ${theme.botonPrimario} font-medium`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalCierreX
