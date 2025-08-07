import React from 'react'

/**
 * Componente tooltip para mostrar los resultados de validación de CUIT
 */
const CUITValidacionTooltip = ({ resultado, onIgnorar, isLoading, error, mostrarTooltip, onToggle }) => {
  if (isLoading) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg">
        <div className="flex items-center text-blue-700">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
          <span className="text-sm">Validando CUIT...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg">
        <div className="flex items-center text-red-700">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">Error: {error}</span>
        </div>
      </div>
    )
  }

  if (!resultado || !mostrarTooltip) {
    return null
  }

  const esValido = resultado.es_valido
  const bgColor = esValido ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
  const textColor = esValido ? 'text-green-700' : 'text-red-700'
  const iconColor = esValido ? 'text-green-600' : 'text-red-600'

  return (
    <div className={`absolute z-50 mt-2 p-4 ${bgColor} border rounded-lg shadow-lg max-w-md`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className={`text-sm font-semibold ${textColor}`}>
          {esValido ? 'CUIT Válido' : 'CUIT Inválido'}
        </h4>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 text-sm"
          aria-label="Cerrar validación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <svg className={`w-5 h-5 mr-2 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20">
            {esValido ? (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            )}
          </svg>
          <span className={`text-sm font-mono ${textColor}`}>
            {resultado.cuit_formateado || resultado.cuit_original}
          </span>
        </div>

        {resultado.tipo_contribuyente && (
          <div className="text-sm text-gray-600">
            <strong>Tipo:</strong> {resultado.tipo_contribuyente}
          </div>
        )}

        {!esValido && resultado.mensaje_error && (
          <div className="text-sm text-red-600 bg-red-100 p-2 rounded">
            {resultado.mensaje_error}
          </div>
        )}

        {esValido && resultado.cuit_limpio && (
          <div className="text-xs text-gray-500">
            <strong>CUIT limpio:</strong> {resultado.cuit_limpio}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={onIgnorar}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Ignorar validación
        </button>
      </div>
    </div>
  )
}

export default CUITValidacionTooltip 