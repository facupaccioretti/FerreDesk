"use client"

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteAPI from '../../utils/useCuentaCorrienteAPI';

const ModalModificarImputaciones = ({ 
    isOpen, 
    onClose, 
    comprobante, 
    onConfirmar, 
    loading = false 
}) => {
    const theme = useFerreDeskTheme()
    const [imputaciones, setImputaciones] = useState([]);
    const [loadingImputaciones, setLoadingImputaciones] = useState(false);
    const [error, setError] = useState(null);
    const { getDetalleComprobante } = useCuentaCorrienteAPI();

    // Constantes de clases FerreDesk
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
    const CLASES_BOTON_SECUNDARIO = "px-6 py-3 rounded-lg font-semibold shadow transition-all duration-200 bg-slate-200 text-slate-700 hover:bg-slate-300"

    const cargarImputaciones = useCallback(async () => {
        if (!comprobante) return;
        
        setLoadingImputaciones(true);
        setError(null);
        
        try {
            const detalle = await getDetalleComprobante(comprobante.ven_id);
            
            // Obtener imputaciones según el tipo de comprobante
            let imputacionesData = [];
            
            if (comprobante.comprobante_tipo === 'factura' || comprobante.comprobante_tipo === 'factura_interna') {
                // Para facturas, mostrar recibos/NC que la imputan
                imputacionesData = [];
                if (detalle.asociados) {
                    for (const aso of detalle.asociados) {
                        try {
                            const response = await fetch(`/api/cuenta-corriente/imputacion-real/${comprobante.ven_id}/${aso.ven_id}/`, {
                                credentials: 'include',
                                headers: {
                                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value,
                                },
                            });
                            if (response.ok) {
                                const impData = await response.json();
                                imputacionesData.push({
                                    imp_id: impData.imp_id,
                                    ven_id: aso.ven_id,
                                    numero_formateado: aso.numero_formateado,
                                    tipo: aso.tipo,
                                    monto_original: parseFloat(aso.imputado),
                                    nuevo_monto: parseFloat(aso.imputado),
                                    es_recibo: true
                                });
                            }
                        } catch (err) {
                            console.error('Error obteniendo ID de imputación:', err);
                        }
                    }
                }
            } else {
                // Para recibos/NC, mostrar facturas que imputan
                imputacionesData = [];
                if (detalle.asociados) {
                    for (const aso of detalle.asociados) {
                        try {
                            const response = await fetch(`/api/cuenta-corriente/imputacion-real/${aso.ven_id}/${comprobante.ven_id}/`, {
                                credentials: 'include',
                                headers: {
                                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value,
                                },
                            });
                            if (response.ok) {
                                const impData = await response.json();
                                imputacionesData.push({
                                    imp_id: impData.imp_id,
                                    ven_id: aso.ven_id,
                                    numero_formateado: aso.numero_formateado,
                                    tipo: aso.tipo,
                                    monto_original: parseFloat(aso.imputado),
                                    nuevo_monto: parseFloat(aso.imputado),
                                    es_recibo: false
                                });
                            }
                        } catch (err) {
                            console.error('Error obteniendo ID de imputación:', err);
                        }
                    }
                }
            }
            
            setImputaciones(imputacionesData);
        } catch (err) {
            setError('Error al cargar las imputaciones: ' + err.message);
        } finally {
            setLoadingImputaciones(false);
        }
    }, [comprobante, getDetalleComprobante]);

    useEffect(() => {
        if (isOpen && comprobante) {
            cargarImputaciones();
        }
    }, [isOpen, comprobante, cargarImputaciones]);

    const handleMontoChange = (index, nuevoMonto) => {
        const nuevasImputaciones = [...imputaciones];
        nuevasImputaciones[index].nuevo_monto = nuevoMonto;
        setImputaciones(nuevasImputaciones);
    };

    const handlePonerEnCero = (index) => {
        handleMontoChange(index, 0);
    };

    const calcularTotales = () => {
        const montoTotalComprobante = parseFloat(comprobante?.ven_total || 0);
        const sumaNuevosMontos = imputaciones.reduce((sum, imp) => sum + imp.nuevo_monto, 0);
        const saldoRestante = montoTotalComprobante - sumaNuevosMontos;
        
        return {
            montoTotalComprobante,
            sumaNuevosMontos,
            saldoRestante,
            esValido: sumaNuevosMontos <= montoTotalComprobante
        };
    };

    const handleConfirmar = () => {
        const { esValido } = calcularTotales();
        
        if (!esValido) {
            setError('La suma de los nuevos montos excede el total del comprobante');
            return;
        }

        // Preparar datos para enviar
        const imputacionesParaEnviar = imputaciones
            .filter(imp => imp.nuevo_monto !== imp.monto_original)
            .map(imp => ({
                imp_id: imp.imp_id,
                nuevo_monto: imp.nuevo_monto
            }));

        if (comprobante) {
            onConfirmar(comprobante.ven_id, imputacionesParaEnviar);
        }
    };

    const handleCancelar = () => {
        setImputaciones([]);
        setError(null);
        onClose();
    };

    const { montoTotalComprobante, sumaNuevosMontos, saldoRestante, esValido } = calcularTotales();

    return (
        <Transition show={isOpen && !!comprobante} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={handleCancelar}>
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
                        <Dialog.Panel className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <Dialog.Title className="text-lg font-bold text-white">
                                            Modificar Imputaciones
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-200">
                                            {comprobante?.numero_formateado} - {comprobante?.comprobante_nombre}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCancelar}
                                    className="text-slate-200 hover:text-white transition-colors"
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

                            {/* Contenido */}
                            <div className="px-6 py-4 overflow-y-auto flex-1">
                                {loadingImputaciones ? (
                                    <div className="flex justify-center items-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        <span className="ml-2 text-slate-600">Cargando imputaciones...</span>
                                    </div>
                                ) : error ? (
                                    <div className={`${CLASES_TARJETA} bg-red-50 border-red-200`}>
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <div className={`${CLASES_ETIQUETA} text-red-600`}>Error</div>
                                                <p className="text-sm text-red-700">{error}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Resumen del comprobante */}
                                        <div className={`${CLASES_TARJETA} mb-4`}>
                                            <div className={CLASES_ETIQUETA}>Resumen del comprobante</div>
                                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                                <div>
                                                    <span className="text-slate-600">Total:</span>
                                                    <span className="ml-2 font-medium">
                                                        ${montoTotalComprobante.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600">Imputado:</span>
                                                    <span className="ml-2 font-medium">
                                                        ${sumaNuevosMontos.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600">Restante:</span>
                                                    <span className={`ml-2 font-medium ${saldoRestante < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        ${saldoRestante.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tabla de imputaciones */}
                                        <div className={CLASES_TARJETA}>
                                            <div className={CLASES_ETIQUETA}>Imputaciones ({imputaciones.length})</div>
                                            <div className="overflow-x-auto mt-3">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                        <tr className={`text-left border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">
                                                                Comprobante
                                                            </th>
                                                            <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-white">
                                                                Monto Original
                                                            </th>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">
                                                                Nuevo Monto
                                                            </th>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">
                                                                Acción
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {imputaciones.map((imputacion, index) => (
                                                            <tr key={index} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                                                                    {`${imputacion.comprobante_nombre} ${imputacion.numero_formateado}`}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-right text-slate-600">
                                                                    ${imputacion.monto_original.toLocaleString()}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={imputacion.nuevo_monto}
                                                                        onChange={(e) => handleMontoChange(index, parseFloat(e.target.value) || 0)}
                                                                        className={CLASES_INPUT}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <button
                                                                        onClick={() => handlePonerEnCero(index)}
                                                                        className="text-red-600 hover:text-red-900 font-medium text-sm"
                                                                    >
                                                                        Poner en 0
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Validación */}
                                        {!esValido && (
                                            <div className={`${CLASES_TARJETA} mt-4 bg-red-50 border-red-200`}>
                                                <div className="flex items-center">
                                                    <svg className="w-5 h-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div>
                                                        <div className={`${CLASES_ETIQUETA} text-red-600`}>Error de validación</div>
                                                        <p className="text-sm text-red-700">
                                                            La suma de los nuevos montos (${sumaNuevosMontos.toLocaleString()}) excede el total del comprobante (${montoTotalComprobante.toLocaleString()}).
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancelar}
                                    disabled={loading}
                                    className={`${CLASES_BOTON_SECUNDARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmar}
                                    disabled={loading || !esValido || loadingImputaciones}
                                    className={`${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Guardando...
                                        </span>
                                    ) : (
                                        'Guardar Cambios'
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

export default ModalModificarImputaciones;
