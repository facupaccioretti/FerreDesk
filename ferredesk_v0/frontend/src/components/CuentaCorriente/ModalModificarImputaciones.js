import React, { useState, useEffect, useCallback } from 'react';
import useCuentaCorrienteAPI from '../../utils/useCuentaCorrienteAPI';

const ModalModificarImputaciones = ({ 
    isOpen, 
    onClose, 
    comprobante, 
    onConfirmar, 
    loading = false 
}) => {
    const [imputaciones, setImputaciones] = useState([]);
    const [loadingImputaciones, setLoadingImputaciones] = useState(false);
    const [error, setError] = useState(null);
    const { getDetalleComprobante } = useCuentaCorrienteAPI();

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
                // Necesitamos obtener los IDs reales de las imputaciones
                imputacionesData = [];
                if (detalle.asociados) {
                    for (const aso of detalle.asociados) {
                        // Buscar la imputación real en la tabla para obtener el imp_id
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
                // Necesitamos obtener los IDs reales de las imputaciones
                imputacionesData = [];
                if (detalle.asociados) {
                    for (const aso of detalle.asociados) {
                        // Buscar la imputación real en la tabla para obtener el imp_id
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
        const montoTotalComprobante = parseFloat(comprobante.ven_total || 0);
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

        onConfirmar(comprobante.ven_id, imputacionesParaEnviar);
    };

    const handleCancelar = () => {
        setImputaciones([]);
        setError(null);
        onClose();
    };

    if (!isOpen || !comprobante) return null;

    const { montoTotalComprobante, sumaNuevosMontos, saldoRestante, esValido } = calcularTotales();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Modificar Imputaciones
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {comprobante.numero_formateado} - {comprobante.comprobante_nombre}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCancelar}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <span className="sr-only">Cerrar</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                    {loadingImputaciones ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-gray-600">Cargando imputaciones...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <span className="text-red-400">⚠️</span>
                                </div>
                                <div className="ml-3">
                                    <h4 className="text-sm font-medium text-red-800">Error</h4>
                                    <p className="mt-1 text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Resumen del comprobante */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-2">
                                    Resumen del Comprobante
                                </h4>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Total:</span>
                                        <span className="ml-2 font-medium">
                                            ${montoTotalComprobante.toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Imputado:</span>
                                        <span className="ml-2 font-medium">
                                            ${sumaNuevosMontos.toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Restante:</span>
                                        <span className={`ml-2 font-medium ${saldoRestante < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${saldoRestante.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de imputaciones */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Comprobante
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Tipo
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Monto Original
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Nuevo Monto
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Acción
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {imputaciones.map((imputacion, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {imputacion.numero_formateado}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {imputacion.tipo}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    ${imputacion.monto_original.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={imputacion.nuevo_monto}
                                                        onChange={(e) => handleMontoChange(index, parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                    <button
                                                        onClick={() => handlePonerEnCero(index)}
                                                        className="text-red-600 hover:text-red-900 font-medium"
                                                    >
                                                        Poner en 0
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Validación */}
                            {!esValido && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <span className="text-red-400">⚠️</span>
                                        </div>
                                        <div className="ml-3">
                                            <h4 className="text-sm font-medium text-red-800">Error de validación</h4>
                                            <p className="mt-1 text-sm text-red-700">
                                                La suma de los nuevos montos (${sumaNuevosMontos.toLocaleString()}) excede el total del comprobante (${montoTotalComprobante.toLocaleString()}).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={handleCancelar}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmar}
                        disabled={loading || !esValido || loadingImputaciones}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Guardando...
                            </div>
                        ) : (
                            'Guardar Cambios'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalModificarImputaciones;
