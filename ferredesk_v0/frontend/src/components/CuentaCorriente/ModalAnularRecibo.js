import React from 'react';

const ModalAnularRecibo = ({ 
    isOpen, 
    onClose, 
    recibo, 
    onConfirmar, 
    loading = false 
}) => {
    if (!isOpen || !recibo) return null;

    const handleConfirmar = () => {
        onConfirmar(recibo.ven_id);
    };

    const handleCancelar = () => {
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <polyline points="3,6 5,6 21,6"/>
                                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                Anular Recibo
                            </h3>
                            <p className="text-sm text-gray-500">
                                Esta acción no se puede deshacer
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    <div className="space-y-4">
                        {/* Información del recibo */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-2">
                                Recibo a anular:
                            </h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Número:</span>
                                    <span className="font-medium">{recibo.numero_formateado}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Fecha:</span>
                                    <span>{new Date(recibo.ven_fecha).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Monto:</span>
                                    <span className="font-medium text-green-600">
                                        ${parseFloat(recibo.ven_total || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Advertencia */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h4 className="text-sm font-medium text-red-800">
                                        Advertencia
                                    </h4>
                                    <p className="mt-1 text-sm text-red-700">
                                        Al anular este recibo se eliminarán:
                                    </p>
                                    <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                                        <li>El recibo completo</li>
                                        <li>Todas las imputaciones asociadas</li>
                                        <li>El historial de pagos</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Confirmación */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                <strong>¿Está seguro de que desea anular este recibo?</strong>
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                                Esta acción es irreversible y afectará la cuenta corriente del cliente.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
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
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            'Anular Recibo'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalAnularRecibo;
