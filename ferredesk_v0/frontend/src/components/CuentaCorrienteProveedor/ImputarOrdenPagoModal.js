"use client"

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteProveedorAPI from '../../utils/useCuentaCorrienteProveedorAPI';

/**
 * Modal para imputar órdenes de pago o notas de crédito existentes contra facturas pendientes
 * 
 * @param {boolean} open - Si el modal está abierto
 * @param {function} onClose - Función para cerrar el modal
 * @param {object} comprobante - La OP o NC a imputar (con saldo_pendiente, etc.)
 * @param {number} proveedorId - ID del proveedor
 * @param {function} onImputado - Callback cuando se completa la imputación
 */
export default function ImputarOrdenPagoModal({
    open,
    onClose,
    comprobante,
    proveedorId,
    onImputado
}) {
    const theme = useFerreDeskTheme()
    const { getFacturasPendientes, imputarOrdenPago } = useCuentaCorrienteProveedorAPI();

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
            const data = await getFacturasPendientes(proveedorId);
            // La API de proveedores retorna 'compras_pendientes', la de clientes 'facturas'
            setFacturasPendientes(data.compras_pendientes || data.facturas || []);
        } catch (err) {
            console.error('Error cargando facturas pendientes:', err);
            setError('Error al cargar las facturas pendientes');
            setFacturasPendientes([]);
        } finally {
            setLoading(false);
        }
    }, [proveedorId, getFacturasPendientes]);

    useEffect(() => {
        if (open && proveedorId) {
            cargarFacturasPendientesHandler();
        }
    }, [open, proveedorId, cargarFacturasPendientesHandler]);

    // Inicializar imputaciones cuando cambian las facturas
    useEffect(() => {
        const pendientes = facturasPendientes || [];
        if (pendientes.length > 0) {
            setImputaciones(
                pendientes.map(f => ({
                    factura_id: f.compra_id || f.id, // Usar 'compra_id' según view o 'id'
                    monto: 0,
                }))
            );
        }
    }, [facturasPendientes]);

    // Calcular monto total de imputaciones
    const montoImputaciones = imputaciones.reduce(
        (sum, imp) => sum + (parseFloat(imp.monto) || 0),
        0
    );

    // Saldo disponible del comprobante
    const saldoDisponible = comprobante?.saldo_pendiente || 0;

    const handleImputacionChange = (index, valor) => {
        const nuevasImputaciones = [...imputaciones];
        nuevasImputaciones[index] = {
            ...nuevasImputaciones[index],
            monto: valor
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
            setError(`El monto total (${Number(montoImputaciones).toFixed(2)}) no puede superar el saldo disponible (${Number(saldoDisponible).toFixed(2)})`);
            return;
        }

        // Filtrar solo las imputaciones con monto > 0
        const imputacionesValidas = imputaciones.filter(imp => parseFloat(imp.monto) > 0);

        if (imputacionesValidas.length === 0) {
            setError('Debe ingresar al menos un monto a imputar');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // El comprobante ID puede ser 'op_id' o 'id' dependiendo del origen
            const ordenPagoId = comprobante.op_id || comprobante.id;

            await imputarOrdenPago({
                orden_pago_id: ordenPagoId, // O 'comprobante_id' si generalizamos
                proveedor_id: proveedorId,
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

    const tipoComprobanteLabel = (comprobante.comprobante_tipo === 'orden_pago' || comprobante.tipo === 'orden_pago') ? 'Orden de Pago' : 'Nota de Crédito';

    return (
        <Transition show={open} as={Fragment} appear>
            <Dialog as="div" className="relative z-50" onClose={handleCancelar}>
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
                        <Dialog.Panel className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                                <Dialog.Title className="text-lg font-bold text-white">
                                    Imputar {tipoComprobanteLabel}: {comprobante.numero_formateado || comprobante.op_numero}
                                </Dialog.Title>
                                <button onClick={handleCancelar} className="text-slate-200 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
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

                                {/* Información */}
                                <div className={`${CLASES_TARJETA} mb-4`}>
                                    <div className={CLASES_ETIQUETA}>Información del comprobante</div>
                                    <div className="mt-3 text-sm">
                                        <p className="text-slate-700 font-medium">{tipoComprobanteLabel} {comprobante.numero_formateado || comprobante.op_numero}</p>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <span className="text-slate-500">Saldo disponible:</span>
                                                <span className="ml-2 font-semibold">${Number(saldoDisponible).toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Fecha:</span>
                                                <span className="ml-2">{comprobante.fecha}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center items-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        <span className="ml-2 text-slate-600">Cargando facturas...</span>
                                    </div>
                                ) : facturasPendientes.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 italic">No hay facturas pendientes.</div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-medium uppercase">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Fecha</th>
                                                    <th className="px-4 py-2 text-left">Comprobante</th>
                                                    <th className="px-4 py-2 text-right">Saldo</th>
                                                    <th className="px-4 py-2 text-right">Pago</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {facturasPendientes.map((factura, index) => (
                                                    <tr key={factura.compra_id || factura.id}>
                                                        <td className="px-4 py-2">{factura.fecha}</td>
                                                        <td className="px-4 py-2 font-medium">{factura.numero_formateado || `Factura ${factura.compra_id}`}</td>
                                                        <td className="px-4 py-2 text-right">${parseFloat(factura.saldo_pendiente).toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-right">
                                                            <input
                                                                type="number"
                                                                className="w-24 border border-slate-300 rounded px-2 py-1 text-right focus:ring-1 focus:ring-orange-500"
                                                                value={imputaciones[index]?.monto || ''}
                                                                onChange={(e) => handleImputacionChange(index, e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-2">
                                <button onClick={handleCancelar} className={CLASES_BOTON_SECUNDARIO}>Cancelar</button>
                                <button
                                    onClick={handleAceptar}
                                    disabled={loading || montoImputaciones === 0 || montoImputaciones > saldoDisponible}
                                    className={`${theme.botonPrimario} ${loading || montoImputaciones === 0 || montoImputaciones > saldoDisponible ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Procesando...' : 'Confirmar Imputación'}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
}
