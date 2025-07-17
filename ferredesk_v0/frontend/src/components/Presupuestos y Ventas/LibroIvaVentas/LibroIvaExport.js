import React, { useState } from 'react';

const LibroIvaExport = ({ libroIva, onExportar, loading }) => {
  const [exportando, setExportando] = useState(false);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState('');

  const formatosDisponibles = [
    {
      id: 'pdf',
      nombre: 'PDF',
      descripcion: 'Documento oficial para presentación a AFIP',
      icono: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'excel',
      nombre: 'Excel',
      descripcion: 'Hoja de cálculo editable para contador',
      icono: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'json',
      nombre: 'JSON',
      descripcion: 'Datos estructurados para integración',
      icono: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
  ];

  const handleExportar = async (formato) => {
    if (!libroIva || !libroIva.periodo) {
      alert('No hay datos del libro IVA para exportar');
      return;
    }

    setExportando(true);
    setFormatoSeleccionado(formato);

    try {
      await onExportar(formato, libroIva.periodo.mes, libroIva.periodo.anio);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert(`Error al exportar ${formato.toUpperCase()}: ${error.message}`);
    } finally {
      setExportando(false);
      setFormatoSeleccionado('');
    }
  };

  if (!libroIva) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Exportar Libro IVA
        </h3>
        <div className="text-sm text-gray-600">
          {libroIva.estadisticas?.total_comprobantes || 0} comprobantes
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {formatosDisponibles.map((formato) => (
          <div
            key={formato.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-orange-600">
                {formato.icono}
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{formato.nombre}</h4>
                <p className="text-sm text-gray-600">{formato.descripcion}</p>
              </div>
            </div>

            <button
              onClick={() => handleExportar(formato.id)}
              disabled={loading || exportando}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${
                exportando && formatoSeleccionado === formato.id
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {exportando && formatoSeleccionado === formato.id ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exportando...
                </div>
              ) : (
                `Exportar ${formato.nombre}`
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Información de Exportación</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>PDF:</strong> Formato oficial para presentación a AFIP</li>
              <li>• <strong>Excel:</strong> Incluye fórmulas y formato para análisis</li>
              <li>• <strong>JSON:</strong> Datos estructurados para integración con otros sistemas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibroIvaExport;