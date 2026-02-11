"use client"

import { Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal para confirmar acciones sobre un cheque (Rechazo o Reactivación).
 * Informa al usuario que debe generar la documentación manual correspondiente.
 * Siguiendo la estética estándar de FerreDesk.
 *
 * @param {object} cheque - Cheque a procesar
 * @param {string} modo - 'rechazar' | 'reactivar'
 * @param {function} formatearMoneda - Función para formatear montos
 * @param {function} onConfirmar - () => void
 * @param {function} onCancelar - () => void
 * @param {boolean} loading - Deshabilita el botón de confirmar
 */
const ModalMarcarChequeRechazado = ({
  cheque,
  modo = "rechazar",
  formatearMoneda,
  onConfirmar,
  onCancelar,
  loading
}) => {
  const theme = useFerreDeskTheme()

  const esRechazo = modo === "rechazar"
  const titulo = esRechazo ? "Marcar cheque rechazado" : "Reactivar cheque"
  const labelBoton = esRechazo ? "Marcar rechazado" : "Reactivar cheque"

  const handleConfirmar = (e) => {
    e?.preventDefault()
    onConfirmar()
  }

  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"

  return (
    <Transition show={!!cheque} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onCancelar}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
              <div
                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
              >
                <Dialog.Title className="text-lg font-bold text-white">
                  {titulo}
                </Dialog.Title>
                <button
                  type="button"
                  onClick={onCancelar}
                  className="text-slate-200 hover:text-white transition-colors"
                  aria-label="Cerrar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className={CLASES_TARJETA}>
                  <div className={CLASES_ETIQUETA}>Cheque</div>
                  <p className="text-sm text-slate-800 mt-1">
                    Nº <strong>{cheque?.numero}</strong>
                    {cheque?.banco_emisor && ` (${cheque.banco_emisor})`}
                    {cheque?.monto != null && ` — $${formatearMoneda(cheque.monto)}`}
                  </p>
                </div>

                <div className={CLASES_TARJETA}>
                  <div className={CLASES_ETIQUETA}>Acción requerida</div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {esRechazo
                      ? "Al marcar el cheque como rechazado, deberá generar manualmente una NOTA DE DÉBITO o EXTENSIÓN DE CONTENIDO al cliente para registrar la deuda en su cuenta corriente."
                      : "Al reactivar el cheque, si ya había generado una Nota de Débito anteriormente, deberá generar manualmente una NOTA DE CRÉDITO o MODIFICACIÓN DE CONTENIDO para anular esa deuda."
                    }
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${theme.botonPrimario} disabled:opacity-50`}
                >
                  {loading ? "Procesando..." : labelBoton}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default ModalMarcarChequeRechazado
