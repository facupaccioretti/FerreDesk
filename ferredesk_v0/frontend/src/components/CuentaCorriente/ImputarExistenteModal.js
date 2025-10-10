"use client"

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCuentaCorrienteAPI } from '../../utils/useCuentaCorrienteAPI';

/**
 * Modal para imputar recibos o notas de crédito existentes contra facturas pendientes
 * 
 * @param {boolean} open - Si el modal está abierto
 * @param {function} onClose - Función para cerrar el modal
 * @param {object} comprobante - El recibo o NC a imputar (con ven_id, saldo_pendiente, etc.)
 * @param {number} clienteId - ID del cliente
 * @param {function} onImputado - Callback cuando se completa la imputación
 */
export default function ImputarExistenteModal({ 
    open, 
    onClose, 
    comprobante, 
    clienteId,
    onImputado 
}) {
    const theme = useFerreDeskTheme()
    const { cargarFacturasPendientes, imputarExistente } = useCuentaCorrienteAPI();
    
    const [facturasPendientes, setFacturasPendientes] = useState([]);
    const [imputaciones, setImputaciones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Constantes de clases FerreDesk
    const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
    const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
    const CLASES_BOTON_SECUNDARIO = "px-6 py-3 rounded-lg font-semibold shadow transition-all duration-200 bg-slate-200 text-slate-700 hover:bg-slate-300"

    const cargarFacturasPendientesHandler = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const facturas = await cargarFacturasPendientes(clienteId);
            setFacturasPendientes(facturas || []);
        } catch (err) {
            console.error('Error cargando facturas pendientes:', err);
            setError('Error al cargar las facturas pendientes');
            setFacturasPendientes([]);
        } finally {
            setLoading(false);
        }
    }, [clienteId, cargarFacturasPendientes]);

    // Cargar facturas pendientes cuando se abre el modal
    useEffect(() => {
        if (open && clienteId) {
            cargarFacturasPendientesHandler();
        }
    }, [open, clienteId, cargarFacturasPendientesHandler]);

    // Inicializar imputaciones cuando cambian las facturas
    useEffect(() => {
        if (facturasPendientes.length > 0) {
            setImputaciones(
                facturasPendientes.map(f => ({
                    imp_id_venta: f.ven_id,
                    imp_monto: 0,
                    imp_observacion: ''
                }))
            );
        }
    }, [facturasPendientes]);

    // Calcular monto total de imputaciones
    const montoImputaciones = imputaciones.reduce(
        (sum, imp) => sum + (parseFloat(imp.imp_monto) || 0),
        0
    );

    // Saldo disponible del comprobante
    const saldoDisponible = comprobante?.saldo_pendiente || 0;

    const handleImputacionChange = (index, campo, valor) => {
        const nuevasImputaciones = [...imputaciones];
        nuevasImputaciones[index] = {
            ...nuevasImputaciones[index],
            [campo]: valor
        };
        setImputaciones(nuevasImputaciones);
    };

    const handleAceptar = async () => {
        // Validaciones
        if (montoImputaciones === 0) {
            setError('Debe ingresar al menos un monto a imputar');
            return;
        }

        if (montoImputaciones > saldoDisponible) {
            setError(`El monto total (${montoImputaciones.toFixed(2)}) no puede superar el saldo disponible (${saldoDisponible.toFixed(2)})`);
            return;
        }

        // Filtrar solo las imputaciones con monto > 0
        const imputacionesValidas = imputaciones.filter(imp => parseFloat(imp.imp_monto) > 0);

        if (imputacionesValidas.length === 0) {
            setError('Debe ingresar al menos un monto a imputar');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await imputarExistente({
                comprobante_id: comprobante.ven_id,
                cliente_id: clienteId,
                imputaciones: imputacionesValidas
            });

            // Callback de éxito
            if (onImputado) {
                onImputado();
            }

            // Cerrar modal
            handleCancelar();
        } catch (err) {
            console.error('Error al imputar:', err);
            setError(err.response?.data?.detail || err.message || 'Error al crear las imputaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelar = () => {
        resetearModal();
        onClose();
    };

    const resetearModal = () => {
        setFacturasPendientes([]);
        setImputaciones([]);
        setError(null);
        setLoading(false);
    };

    if (!comprobante) return null;

    const tipoComprobante = comprobante.comprobante_tipo === 'recibo' ? 'Recibo' : 'Nota de Crédito';

    return (
        <Transition show={open} as={Fragment} appear>
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
                                <Dialog.Title className="text-lg font-bold text-white">
                                    Imputar {tipoComprobante}: {comprobante.numero_formateado}
                                </Dialog.Title>
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
                                {error && (
                                    <div className={`${CLASES_TARJETA} mb-4 bg-red-50 border-red-200`}>
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
                                )}

                                {/* Información del comprobante */}
                                <div className={`${CLASES_TARJETA} mb-4`}>
                                    <div className={CLASES_ETIQUETA}>Información del comprobante</div>
                                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                                        <div>
                                            <span className="text-slate-600">Saldo disponible:</span>
                                            <span className="ml-2 font-medium">${saldoDisponible.toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-600">Fecha:</span>
                                            <span className="ml-2">{comprobante.ven_fecha}</span>
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center items-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        <span className="ml-2 text-slate-600">Cargando facturas pendientes...</span>
                                    </div>
                                ) : facturasPendientes.length === 0 ? (
                                    <div className={`${CLASES_TARJETA} bg-blue-50 border-blue-200`}>
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <div className={`${CLASES_ETIQUETA} text-blue-600`}>Información</div>
                                                <p className="text-sm text-blue-700">
                                                    No hay facturas o cotizaciones pendientes de imputar para este cliente.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tabla de facturas */}
                                        <div className={CLASES_TARJETA}>
                                            <div className={CLASES_ETIQUETA}>Seleccione las facturas a imputar ({facturasPendientes.length})</div>
                                            <div className="overflow-x-auto mt-3">
                                                <table className="min-w-full text-sm">
                                                    <thead>
                                                        <tr className={`text-left border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">Fecha</th>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">Comprobante</th>
                                                            <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-white">Importe</th>
                                                            <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-white">Imputado</th>
                                                            <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">Pago Actual</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {facturasPendientes.map((factura, index) => {
                                                            const imputado = factura.ven_total - factura.saldo_pendiente;
                                                            return (
                                                                <tr key={factura.ven_id} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3 whitespace-nowrap">{factura.ven_fecha}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                                                                        {factura.comprobante_nombre ? `${factura.comprobante_nombre} ${factura.numero_formateado}` : factura.numero_formateado}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                                                        ${parseFloat(factura.ven_total).toFixed(2)}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                                                        ${imputado.toFixed(2)}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={factura.saldo_pendiente}
                                                                            step="0.01"
                                                                            value={imputaciones[index]?.imp_monto || ''}
                                                                            onChange={(e) => handleImputacionChange(index, 'imp_monto', e.target.value)}
                                                                            className="w-24 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right"
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Resumen */}
                                        <div className={`${CLASES_TARJETA} mt-4`}>
                                            <div className={CLASES_ETIQUETA}>Resumen de imputación</div>
                                            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                                                <div>
                                                    <span className="text-slate-600">Facturas seleccionadas:</span>
                                                    <span className="ml-2 font-medium">
                                                        {imputaciones.filter(i => parseFloat(i.imp_monto) > 0).length}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-600">Monto total:</span>
                                                    <span className={`ml-2 font-medium ${montoImputaciones > saldoDisponible ? 'text-red-600' : 'text-green-600'}`}>
                                                        ${montoImputaciones.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {montoImputaciones > saldoDisponible && (
                                            <div className={`${CLASES_TARJETA} mt-4 bg-red-50 border-red-200`}>
                                                <div className="flex items-center">
                                                    <svg className="w-5 h-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div>
                                                        <div className={`${CLASES_ETIQUETA} text-red-600`}>Error de validación</div>
                                                        <p className="text-sm text-red-700">
                                                            El monto total excede el saldo disponible del {tipoComprobante.toLowerCase()}
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
                                    onClick={handleCancelar}
                                    disabled={loading}
                                    className={`${CLASES_BOTON_SECUNDARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAceptar}
                                    disabled={loading || montoImputaciones === 0 || montoImputaciones > saldoDisponible}
                                    className={`${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {loading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Procesando...
                                        </span>
                                    ) : (
                                        'Aceptar'
                                    )}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
}
