import React from 'react'

/**
 * Componente tooltip simplificado para mostrar los resultados de validación de CUIT
 * Ahora que usamos el padrón, es solo informativo interno
 */
const CUITValidacionTooltip = ({ resultado, onIgnorar, isLoading, error, mostrarTooltip, onToggle, errorARCA }) => {
  if (isLoading) {
    return null
  }

  // Si no se solicitó mostrar el tooltip explícitamente, no renderizar nada
  if (!mostrarTooltip) {
    return null
  }

  // Priorizar errores de ARCA si existen
  const hayErrorARCA = errorARCA && errorARCA.trim() !== ''

  if (hayErrorARCA) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg w-[520px] max-w-[70vw]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center text-red-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Error ARCA</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onToggle) onToggle()
            }}
            className="text-gray-400 hover:text-gray-600 text-sm"
            aria-label="Cerrar validación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 break-words text-left">
          {errorARCA}
        </div>
      </div>
    )
  }

  // Si hay error local del dígito verificador
  if (error) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg w-[520px] max-w-[70vw]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center text-red-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">CUIT Inválido</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onToggle) onToggle()
            }}
            className="text-gray-400 hover:text-gray-600 text-sm"
            aria-label="Cerrar validación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {typeof resultado?.mensaje_error === 'string' && resultado.mensaje_error.trim() !== '' && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 break-words text-left">
            {resultado.mensaje_error}
          </div>
        )}
      </div>
    )
  }

  // Si no hay resultado, no mostrar nada
  if (!resultado) {
    return null
  }

  const esValido = !!resultado.es_valido

  if (esValido) {
    return (
      <div className="absolute z-50 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg shadow-lg w-[420px] max-w-[60vw]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center text-green-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">CUIT Válido</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onToggle) onToggle()
            }}
            className="text-gray-400 hover:text-gray-600 text-sm"
            aria-label="Cerrar validación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // CUIT inválido por resultado (sin ARCA)
  return (
    <div className="absolute z-50 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg w-[520px] max-w-[70vw]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center text-red-700">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">CUIT Inválido</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onToggle) onToggle()
          }}
          className="text-gray-400 hover:text-gray-600 text-sm"
          aria-label="Cerrar validación"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {typeof resultado?.mensaje_error === 'string' && resultado.mensaje_error.trim() !== '' && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 break-words text-left">
          {resultado.mensaje_error}
        </div>
      )}
    </div>
  )
}

export default CUITValidacionTooltip 