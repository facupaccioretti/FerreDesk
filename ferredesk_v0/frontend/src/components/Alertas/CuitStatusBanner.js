import React from 'react'

/**
 * Banner informativo para mostrar el estado del CUIT al consultar ARCA.
 * Se muestra solo cuando la letra fiscal es A y hay información relevante del CUIT.
 * No bloquea la emisión, solo informa al usuario sobre observaciones de ARCA.
 */
const CuitStatusBanner = ({ cuit, estado, mensajes = [], onDismiss }) => {
  if (!estado || estado === 'ok') {
    return null
  }

  // Determinar estilo según el estado
  const estilos = {
    observado: {
      fondo: 'bg-yellow-50 border-yellow-200',
      icono: 'text-yellow-600',
      texto: 'text-yellow-800',
      titulo: 'CUIT Observado en ARCA'
    },
    error: {
      fondo: 'bg-red-50 border-red-200', 
      icono: 'text-red-600',
      texto: 'text-red-800',
      titulo: 'Error al consultar ARCA'
    }
  }

  const estilo = estilos[estado] || estilos.error

  return (
    <div className={`mb-4 p-4 rounded-lg border ${estilo.fondo} ${estilo.texto}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {/* Ícono de alerta */}
          <div className={`flex-shrink-0 ${estilo.icono}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          
          <div className="flex-grow">
            {/* Título */}
            <h4 className="font-semibold text-sm mb-1">
              {estilo.titulo}
            </h4>
            
            {/* CUIT */}
            {cuit && (
              <p className="text-sm font-mono mb-2">
                <strong>CUIT:</strong> {cuit}
              </p>
            )}
            
            {/* Mensajes de ARCA */}
            {mensajes && mensajes.length > 0 && (
              <div className="space-y-1">
                {mensajes.map((mensaje, index) => (
                  <p key={index} className="text-sm">
                    {mensaje}
                  </p>
                ))}
              </div>
            )}
            
            {/* Texto informativo */}
            <p className="text-xs mt-2 opacity-75">
              Esta información es consultada automáticamente desde ARCA. 
              Puede continuar con la emisión de todos modos.
            </p>
          </div>
        </div>
        
        {/* Botón para cerrar */}
        <button
          type="button"
          onClick={onDismiss}
          className={`flex-shrink-0 ml-3 ${estilo.icono} hover:opacity-75 transition-opacity`}
          title="Cerrar aviso"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Botón de continuar (opcional, visual) */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium underline hover:no-underline transition-all"
        >
          Continuar de todos modos
        </button>
      </div>
    </div>
  )
}

export default CuitStatusBanner
