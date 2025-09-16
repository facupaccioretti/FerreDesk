"use client"

import { useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { Fragment } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

const EliminadorResiduoModal = ({ 
  open, 
  onClose, 
  onConfirmar,
  loading = false 
}) => {
  const theme = useFerreDeskTheme()
  const [diasAntiguedad, setDiasAntiguedad] = useState(30)
  const [error, setError] = useState(null)

  // Función para confirmar eliminación
  const handleConfirmar = () => {
    if (diasAntiguedad < 1) {
      setError("Los días de antigüedad deben ser al menos 1")
      return
    }
    onConfirmar(diasAntiguedad)
  }

  // Limpiar estado al cerrar
  const handleClose = () => {
    setError(null)
    setDiasAntiguedad(30)
    onClose()
  }

  if (!open) return null

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all border border-slate-200/50">
                {/* Header con estilo FerreDesk */}
                <div className={`px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r ${theme.primario}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </div>
                      <Dialog.Title as="h2" className="text-xl font-bold text-white">
                        Eliminar Presupuestos Viejos
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Contenido del modal */}
                <div className="px-5 py-6">
                  {/* Configuración de días */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Eliminar presupuestos con más de:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={diasAntiguedad}
                        onChange={(e) => setDiasAntiguedad(Number(e.target.value))}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        min="1"
                        max="365"
                        disabled={loading}
                      />
                      <span className="text-sm text-slate-600 font-medium">días de antigüedad</span>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-800 font-medium">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción con estilo FerreDesk */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleConfirmar}
                      disabled={loading || diasAntiguedad < 1}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Eliminando...
                        </div>
                      ) : (
                        "Confirmar Eliminación"
                      )}
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default EliminadorResiduoModal
