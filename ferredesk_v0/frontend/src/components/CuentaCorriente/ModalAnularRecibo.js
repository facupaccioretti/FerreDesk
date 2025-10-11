"use client"

import { Fragment } from 'react';
import { Dialog, Transition } from "@headlessui/react"

const ModalAnularRecibo = ({ 
    isOpen, 
    onClose, 
    item, 
    onConfirmar, 
    loading = false 
}) => {
    // Constantes de clases FerreDesk
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
    const CLASES_BOTON_SECUNDARIO = "px-6 py-3 rounded-lg font-semibold shadow transition-all duration-200 bg-slate-200 text-slate-700 hover:bg-slate-300"
    const CLASES_BOTON_PELIGRO = "px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"

    const esAutoimputacion = item?.comprobante_tipo === 'factura_recibo'
    
    const handleConfirmar = () => {
        if (item) {
            onConfirmar(item);
        }
    };

    return (
        <Transition show={isOpen && !!item} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Fondo oscuro */}
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

                {/* Panel del modal */}
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
                        <Dialog.Panel className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-red-600 to-red-700">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <polyline points="3,6 5,6 21,6" strokeWidth="2"/>
                                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" strokeWidth="2"/>
                                            <line x1="10" y1="11" x2="10" y2="17" strokeWidth="2"/>
                                            <line x1="14" y1="11" x2="14" y2="17" strokeWidth="2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <Dialog.Title className="text-lg font-bold text-white">
                                            {esAutoimputacion ? 'Anular Autoimputación' : 'Anular Recibo'}
                                        </Dialog.Title>
                                        <p className="text-sm text-red-100">
                                            Esta acción no se puede deshacer
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Contenido */}
                            <div className="px-6 py-4">
                                {/* Información del recibo/autoimputación */}
                                <div className={`${CLASES_TARJETA} mb-4 bg-slate-50`}>
                                    <div className={CLASES_ETIQUETA}>{esAutoimputacion ? 'Autoimputación a anular' : 'Recibo a anular'}</div>
                                    <div className="space-y-2 mt-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Número:</span>
                                            <span className="font-medium">{item?.numero_formateado}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Fecha:</span>
                                            <span>{item?.ven_fecha ? new Date(item.ven_fecha).toLocaleDateString() : '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Monto:</span>
                                            <span className="font-medium text-green-600">
                                                ${item?.ven_total ? parseFloat(item.ven_total).toLocaleString() : '0'}
                                            </span>
                                        </div>
                                        {esAutoimputacion && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Tipo:</span>
                                                <span className="font-medium text-blue-600">Autoimputación</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Advertencia */}
                                <div className={`${CLASES_TARJETA} mb-4 bg-red-50 border-red-200`}>
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <div className={`${CLASES_ETIQUETA} text-red-600`}>Advertencia</div>
                                            <p className="mt-1 text-sm text-red-700">
                                                {esAutoimputacion 
                                                    ? 'Al anular esta autoimputación se eliminarán:'
                                                    : 'Al anular este recibo se eliminarán:'
                                                }
                                            </p>
                                            <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                                                {esAutoimputacion ? (
                                                    <>
                                                        <li>La autoimputación completa</li>
                                                        <li>El registro original (factura/cotización)</li>
                                                        <li>Todo el historial de la transacción</li>
                                                    </>
                                                ) : (
                                                    <>
                                                        <li>El recibo completo</li>
                                                        <li>Todas las imputaciones asociadas</li>
                                                        <li>El historial de pagos</li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Confirmación */}
                                <div className={`${CLASES_TARJETA} bg-yellow-50 border-yellow-200`}>
                                    <p className="text-sm text-yellow-800 font-medium">
                                        ¿Está seguro de que desea anular {esAutoimputacion ? 'esta autoimputación' : 'este recibo'}?
                                    </p>
                                    <p className="text-sm text-yellow-700 mt-1">
                                        Esta acción es irreversible y afectará la cuenta corriente del cliente.
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className={`${CLASES_BOTON_SECUNDARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmar}
                                    disabled={loading}
                                    className={`${CLASES_BOTON_PELIGRO} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? (
                                        <div className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Anulando...
                                        </div>
                                    ) : (
                                        esAutoimputacion ? 'Anular Autoimputación' : 'Anular Recibo'
                                    )}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
};

export default ModalAnularRecibo;
