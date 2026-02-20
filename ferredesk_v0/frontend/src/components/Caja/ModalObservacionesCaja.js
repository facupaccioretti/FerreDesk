"use client"

import { Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { X, ClipboardList, Info } from "lucide-react"

/**
 * Modal para revisar observaciones de trámites (ventas y recibos) 
 * capturadas durante el cobro. Utiliza Headless UI para consistencia.
 */
const ModalObservacionesCaja = ({ tramites, onCerrar }) => {
    const theme = useFerreDeskTheme()

    const formatMoney = (value) => {
        const num = parseFloat(value) || 0
        return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    return (
        <Transition show={!!tramites} as={Fragment} appear>
            <Dialog as="div" className="relative z-[60]" onClose={onCerrar}>
                {/* Backdrop con transición */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 flex items-center justify-center p-2">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className={`bg-gradient-to-r ${theme.primario} px-4 py-2.5 flex-shrink-0 flex justify-between items-center`}>
                                <Dialog.Title className="text-base font-bold text-white flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5" strokeWidth={2.5} />
                                    Revisiones Pendientes ({tramites?.length || 0})
                                </Dialog.Title>
                                <button
                                    onClick={onCerrar}
                                    className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                {tramites && tramites.length > 0 ? (
                                    <div className="space-y-3">
                                        {tramites.map((t, idx) => (
                                            <div key={`${t.tipo}-${t.id}-${idx}`} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                <div className="flex justify-between items-start border-b border-slate-200 pb-2 mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${t.tipo === 'VENTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                                }`}>
                                                                {t.tipo}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-700">{t.numero}</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 font-medium truncate max-w-[240px]">{t.cliente}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-slate-800">${formatMoney(t.monto)}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 font-medium">
                                                    {t.observaciones.map((obs, oIdx) => (
                                                        <div key={oIdx} className="flex gap-2 text-xs">
                                                            <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                            <p className="text-slate-600 leading-tight italic">{obs}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center">
                                        <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400">No hay observaciones pendientes.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 pt-2 border-t border-slate-200 flex-shrink-0">
                                <button
                                    onClick={onCerrar}
                                    className={`w-full py-2 text-sm ${theme.botonPrimario} font-medium`}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default ModalObservacionesCaja
