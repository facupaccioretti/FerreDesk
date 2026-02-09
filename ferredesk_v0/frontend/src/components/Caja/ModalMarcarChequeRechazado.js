"use client"

import { Fragment, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

/**
 * Modal para marcar un cheque como rechazado.
 * Pregunta si hubo cargos administrativos del banco y, si corresponde, permite cargar el monto
 * para que se genere un segundo ítem (no gravado) en la Nota de Débito.
 *
 * @param {object} cheque - Cheque a marcar rechazado (numero, banco_emisor, monto, etc.)
 * @param {function} formatearMoneda - Función para formatear montos
 * @param {function} onConfirmar - (cargosAdministrativosBanco: number | null) => void
 * @param {function} onCancelar - () => void
 * @param {boolean} loading - Deshabilita el botón de confirmar
 */
const ModalMarcarChequeRechazado = ({ cheque, formatearMoneda, onConfirmar, onCancelar, loading }) => {
  const theme = useFerreDeskTheme()
  const [tieneCargos, setTieneCargos] = useState(false)
  const [montoCargos, setMontoCargos] = useState("")
  const [error, setError] = useState("")

  const handleConfirmar = (e) => {
    e?.preventDefault()
    setError("")
    if (tieneCargos && montoCargos.trim() !== "") {
      const num = parseFloat(montoCargos.replace(",", "."))
      if (Number.isNaN(num) || num <= 0) {
        setError("Ingrese un monto válido mayor a cero.")
        return
      }
      onConfirmar(num)
    } else {
      onConfirmar(null)
    }
  }

  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_INPUT =
    "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                  Marcar cheque rechazado
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
                  <p className="text-xs text-slate-500 mt-2">
                    Se generará una Nota de Débito por el monto del cheque. El cliente queda con saldo en cuenta corriente.
                  </p>
                </div>

                <div className={CLASES_TARJETA}>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tieneCargos}
                      onChange={(e) => {
                        setTieneCargos(e.target.checked)
                        if (!e.target.checked) setMontoCargos("")
                        setError("")
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Tuvo cargos administrativos del banco</span>
                  </label>
                  {tieneCargos && (
                    <div className="mt-3 pl-6 space-y-1">
                      <label htmlFor="monto-cargos" className={CLASES_ETIQUETA}>
                        Monto debitado por el banco ($)
                      </label>
                      <input
                        id="monto-cargos"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={montoCargos}
                        onChange={(e) => {
                          setMontoCargos(e.target.value)
                          setError("")
                        }}
                        className={CLASES_INPUT}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Se agregará un ítem &quot;Cargos administrativos banco&quot; (no gravado) en la ND.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                )}
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
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${theme.botonPrimario} disabled:opacity-50`}
                >
                  {loading ? "Guardando..." : "Marcar rechazado"}
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
