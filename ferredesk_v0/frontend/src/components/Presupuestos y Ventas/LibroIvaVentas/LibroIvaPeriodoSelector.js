import React, { useState } from 'react';

const LibroIvaPeriodoSelector = ({ onGenerar, loading, disabled = false }) => {
  const [mes, setMes] = useState(new Date().getMonth() + 1); // Mes actual
  const [anio, setAnio] = useState(new Date().getFullYear()); // Año actual
  const [tipoLibro, setTipoLibro] = useState('convencional');
  const [incluirPresupuestos, setIncluirPresupuestos] = useState(false);
  const [error, setError] = useState('');

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  const validarPeriodo = () => {
    setError('');
    
    // Validar mes
    if (mes < 1 || mes > 12) {
      setError('El mes debe estar entre 1 y 12');
      return false;
    }
    
    // Validar año
    if (anio < 2020 || anio > 2030) {
      setError('El año debe estar entre 2020 y 2030');
      return false;
    }
    
    // Validar que no sea período futuro
    const fechaActual = new Date();
    const fechaPeriodo = new Date(anio, mes - 1, 1);
    
    if (fechaPeriodo > fechaActual) {
      setError('No se puede generar libro IVA para períodos futuros');
      return false;
    }
    
    return true;
  };

  const handleGenerar = () => {
    if (validarPeriodo()) {
      onGenerar(mes, anio, tipoLibro, incluirPresupuestos);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleGenerar();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Generar Libro IVA Ventas
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Selecciona el período a generar
        </div>
      </div>

      {/* Selector de Tipo de Libro */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Libro IVA
        </label>
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="radio"
              id="convencional"
              name="tipoLibro"
              value="convencional"
              checked={tipoLibro === 'convencional'}
              onChange={(e) => setTipoLibro(e.target.value)}
              disabled={disabled || loading}
              className="mr-2"
            />
            <label htmlFor="convencional" className="text-sm text-gray-700">
              <strong>Convencional:</strong> Solo documentos fiscales (Factura A/B/C, Nota de Crédito A/B/C, Nota de Débito A/B/C)
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="radio"
              id="administrativo"
              name="tipoLibro"
              value="administrativo"
              checked={tipoLibro === 'administrativo'}
              onChange={(e) => setTipoLibro(e.target.value)}
              disabled={disabled || loading}
              className="mr-2"
            />
            <label htmlFor="administrativo" className="text-sm text-gray-700">
              <strong>Administrativo:</strong> Todos los movimientos.
            </label>
          </div>
          
          {tipoLibro === 'administrativo' && (
            <div className="ml-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="incluirPresupuestos"
                  checked={incluirPresupuestos}
                  onChange={(e) => setIncluirPresupuestos(e.target.checked)}
                  disabled={disabled || loading}
                  className="mr-2"
                />
                <label htmlFor="incluirPresupuestos" className="text-sm text-gray-700">
                  Incluir presupuestos
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Selector de Mes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mes
          </label>
          <select
            value={mes}
            onChange={(e) => setMes(parseInt(e.target.value))}
            disabled={disabled || loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {meses.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Input de Año */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Año
          </label>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(parseInt(e.target.value) || new Date().getFullYear())}
            onKeyPress={handleKeyPress}
            disabled={disabled || loading}
            min="2020"
            max="2030"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="2024"
          />
        </div>

        {/* Botón Generar */}
        <div className="flex items-end">
          <button
            onClick={handleGenerar}
            disabled={disabled || loading}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generar Libro
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mensaje de Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Información del Período */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-700 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Período seleccionado: <strong>{meses[mes - 1]?.label} {anio}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default LibroIvaPeriodoSelector; 