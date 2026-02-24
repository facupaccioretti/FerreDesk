import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, Transition } from '@headlessui/react';
import TicketVentaRender from './plantillas/TicketVentaRender';
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme";

const ModalTicketVenta = ({ isOpen, onClose, ventaId }) => {
    const theme = useFerreDeskTheme();
    const [ticketData, setTicketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const componentRef = useRef();

    useEffect(() => {
        if (isOpen && ventaId) {
            setLoading(true);
            setError(null);

            fetch(`/api/ventas/${ventaId}/ticket/`, { credentials: 'include' })
                .then(res => {
                    if (!res.ok) throw new Error('Error al obtener datos del ticket');
                    return res.json();
                })
                .then(data => {
                    setTicketData(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error al obtener datos del ticket:", err);
                    setError("No se pudieron cargar los datos del ticket.");
                    setLoading(false);
                });
        }
    }, [isOpen, ventaId]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: ticketData ? `Ticket_${ticketData.numero_formateado}` : 'Ticket',
    });

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
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
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all border border-slate-200">
                                {/* Header con estilo FerreDesk */}
                                <div className={`px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r ${theme.primario}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
                                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <Dialog.Title as="h2" className="text-xl font-bold text-white">
                                                    Visualizador de Ticket
                                                </Dialog.Title>
                                                {ticketData && (
                                                    <p className="text-xs text-slate-300 font-medium tracking-wide">
                                                        {ticketData.comprobante_nombre} Nº {ticketData.numero_formateado}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
                                        >
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {loading && (
                                        <div className="flex flex-col items-center justify-center h-80 text-slate-500">
                                            <div className="relative">
                                                <div className="w-16 h-16 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin"></div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <p className="mt-6 font-semibold text-slate-600 animate-pulse uppercase tracking-widest text-xs">Cargando comprobante...</p>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="bg-red-50 border-2 border-red-100 text-red-700 p-8 rounded-2xl flex flex-col items-center shadow-sm">
                                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <p className="text-center font-bold text-lg">{error}</p>
                                            <button
                                                onClick={onClose}
                                                className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-md"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    )}

                                    {ticketData && !loading && !error && (
                                        <>
                                            <div className="bg-slate-50 p-6 rounded-2xl shadow-inner w-full flex justify-center mb-6 overflow-y-auto max-h-[60vh] border border-slate-100 ring-1 ring-slate-900/5">
                                                <div className="bg-white shadow-lg p-0.5 ring-1 ring-slate-200">
                                                    <TicketVentaRender data={ticketData} ref={componentRef} />
                                                </div>
                                            </div>

                                            <div className="flex gap-4 pt-2">
                                                <button
                                                    onClick={onClose}
                                                    className={`${theme.botonSecundario} flex-1 justify-center flex items-center gap-2`}
                                                >
                                                    Cerrar
                                                </button>

                                                <button
                                                    onClick={() => handlePrint()}
                                                    className={`${theme.botonPrimario} flex-1 justify-center flex items-center gap-2 py-3`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                    </svg>
                                                    Imprimir Ticket
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default ModalTicketVenta;
