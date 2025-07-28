import React from 'react';

/**
 * Componente de overlay que bloquea formularios durante la espera de respuesta de ARCA
 * Muestra un mensaje claro al usuario sobre el estado de procesamiento
 */
const ArcaEsperaOverlay = ({ 
  estaEsperando, 
  mensajePersonalizado = null,
  mostrarDetalles = true 
}) => {
  // Si no está esperando, no mostrar nada
  if (!estaEsperando) {
    return null;
  }

  // Mensaje por defecto
  const mensajePorDefecto = "Esperando respuesta de AFIP para obtener el CAE...";
  const mensajeFinal = mensajePersonalizado || mensajePorDefecto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 relative">
        {/* Indicador de carga animado */}
        <div className="flex flex-col items-center text-center">
          {/* Spinner principal */}
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-orange-200 rounded-full animate-spin">
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-orange-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            
            {/* Icono de AFIP en el centro */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Mensaje principal */}
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Procesando Comprobante Fiscal
          </h3>
          
          <p className="text-slate-600 mb-4 leading-relaxed">
            {mensajeFinal}
          </p>

          {/* Detalles técnicos (opcional) */}
          {mostrarDetalles && (
            <div className="bg-slate-50 rounded-lg p-4 w-full">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Información Técnica</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Comunicándose con AFIP para autorización</li>
                <li>• Generando CAE (Código de Autorización Electrónico)</li>
                <li>• Creando código QR para el comprobante</li>
                <li>• No cierre esta ventana durante el proceso</li>
              </ul>
            </div>
          )}

          {/* Indicador de progreso */}
          <div className="mt-6 w-full">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span>Procesando...</span>
            </div>
          </div>
        </div>

        {/* Mensaje de advertencia */}
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-amber-700 font-medium">
              No cierre ni modifique el formulario durante este proceso
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArcaEsperaOverlay; 