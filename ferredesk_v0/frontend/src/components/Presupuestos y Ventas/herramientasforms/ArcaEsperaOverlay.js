import React from 'react';

/**
 * Componente de overlay que bloquea formularios durante la espera de respuesta de ARCA
 * Muestra diferentes estados: espera, error, éxito con observaciones
 * Solo muestra información relevante para el cliente, sin detalles técnicos internos
 * Usa la misma animación que VentaForm para consistencia visual
 */
const ArcaEsperaOverlay = ({ 
  estaEsperando, 
  mensajePersonalizado = null,
  mostrarDetalles = true,
  respuestaArca = null,
  errorArca = null,
  onAceptar = null
}) => {
  // Si no está esperando y no hay respuesta ni error, no mostrar nada
  if (!estaEsperando && !respuestaArca && !errorArca) {
    return null;
  }

  // Función para manejar el clic en aceptar
  const handleAceptar = () => {
    if (onAceptar) {
      onAceptar();
    }
  };

  // Mensaje por defecto
  const mensajePorDefecto = "Esperando respuesta de AFIP para obtener el CAE...";
  const mensajeFinal = mensajePersonalizado || mensajePorDefecto;

  // Renderizar estado de error
  if (errorArca) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 relative">
          <div className="flex flex-col items-center text-center">
            
            {/* Icono de error */}
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>

            {/* Título de error */}
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Error en la Emisión Fiscal
            </h3>
            
            {/* Mensaje de error */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full mb-6">
              <p className="text-red-700 text-sm leading-relaxed">
                {typeof errorArca === 'string' ? errorArca : 'Error desconocido en la emisión ARCA'}
              </p>
            </div>

            {/* Botón de aceptar */}
            <button
              onClick={handleAceptar}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Aceptar
            </button>

            {/* Mensaje de ayuda */}
            <p className="text-xs text-slate-500 mt-4">
              Revise los datos del formulario y vuelva a intentar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar estado de éxito con observaciones
  if (respuestaArca) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 relative">
          <div className="flex flex-col items-center text-center">
            
            {/* Icono de éxito */}
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Título de éxito */}
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              {respuestaArca.cae ? 'Comprobante Emitido Exitosamente' : 'Comprobante Creado Exitosamente'}
            </h3>
            
            {/* Información del CAE o mensaje de comprobante interno */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full mb-4">
              <div className="space-y-2 text-sm">
                {respuestaArca.cae ? (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium text-green-700">CAE:</span>
                      <span className="text-green-800">{respuestaArca.cae}</span>
                    </div>
                    {respuestaArca.cae_vencimiento && (
                      <div className="flex justify-between">
                        <span className="font-medium text-green-700">Vencimiento:</span>
                        <span className="text-green-800">{respuestaArca.cae_vencimiento}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <span className="text-green-700 font-medium">Comprobante Interno</span>
                    <p className="text-green-600 text-xs mt-1">No requiere emisión fiscal</p>
                  </div>
                )}
              </div>
            </div>

            {/* Observaciones si las hay */}
            {(() => {
              console.log('🔍 [OVERLAY DEBUG] respuestaArca:', respuestaArca);
              console.log('🔍 [OVERLAY DEBUG] observaciones:', respuestaArca.observaciones);
              console.log('🔍 [OVERLAY DEBUG] ¿Tiene observaciones?', !!respuestaArca.observaciones);
              console.log('🔍 [OVERLAY DEBUG] ¿Es array?', Array.isArray(respuestaArca.observaciones));
              console.log('🔍 [OVERLAY DEBUG] ¿Tiene length?', respuestaArca.observaciones?.length);
              
                             return Array.isArray(respuestaArca.observaciones) && respuestaArca.observaciones.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 w-full mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-700">Observaciones</span>
                </div>
                <div className="text-amber-700 text-sm leading-relaxed">
                  {Array.isArray(respuestaArca.observaciones) ? (
                    <ul className="space-y-1">
                      {respuestaArca.observaciones.map((obs, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-amber-600 mt-1">•</span>
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{respuestaArca.observaciones}</p>
                  )}
                </div>
              </div>
            );
            })()}

            {/* Botón de aceptar */}
            <button
              onClick={handleAceptar}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar estado de espera (estado original)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 relative">
        {/* Indicador de carga animado - USANDO LA MISMA ANIMACIÓN QUE VENTAFORM */}
        <div className="flex flex-col items-center text-center">
          
          {/* Spinner principal - Mismo estilo que VentaForm */}
          <div className="mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>

          {/* Mensaje principal */}
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Procesando Comprobante Fiscal
          </h3>
          
          <p className="text-slate-600 mb-4 leading-relaxed">
            {mensajeFinal}
          </p>


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