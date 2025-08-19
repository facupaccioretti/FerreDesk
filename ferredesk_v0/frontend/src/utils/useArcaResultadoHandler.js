import { useCallback } from 'react';

/**
 * Hook personalizado para manejar los resultados de ARCA de manera consistente
 * Encapsula la lógica de procesamiento de respuestas de ARCA para evitar repetición
 * en diferentes formularios (VentaForm, NotaCreditoForm, ConVentaForm, etc.)
 */
export const useArcaResultadoHandler = ({
  requiereEmisionArca,
  finalizarEsperaArcaExito,
  finalizarEsperaArcaError,
  esperandoArca,
  iniciarEsperaArca
}) => {
  
  /**
   * Procesa el resultado de una operación que puede requerir emisión ARCA
   * @param {Object} resultado - Respuesta del backend
   * @param {string} tipoComprobante - Tipo de comprobante (factura, nota_credito, etc.)
   */
  const procesarResultadoArca = useCallback((resultado, tipoComprobante) => {
    // DEBUG: Log completo del resultado para ver observaciones
    console.log('[ARCA DEBUG] Resultado completo:', resultado);
    console.log('[ARCA DEBUG] Observaciones recibidas:', resultado?.observaciones);
    console.log('[ARCA DEBUG] Tipo de observaciones:', typeof resultado?.observaciones);
    console.log('[ARCA DEBUG] Es array?', Array.isArray(resultado?.observaciones));
    
    // Procesar respuesta de ARCA: iniciar overlay solo si fue emisión fiscal exitosa
    if (resultado?.arca_emitido === true && resultado?.cae) {
      if (!esperandoArca) {
        iniciarEsperaArca();
      }
      // Éxito: ARCA fue emitido y tiene CAE (comprobante fiscal)
      console.log('[ARCA DEBUG] Enviando observaciones al overlay:', resultado.observaciones || []);
      finalizarEsperaArcaExito({
        cae: resultado.cae,
        cae_vencimiento: resultado.cae_vencimiento,
        qr_generado: resultado.qr_generado,
        observaciones: Array.isArray(resultado.observaciones) ? resultado.observaciones : []
      });
    } else if (resultado?.arca_emitido === false) {
      // Éxito: No se emitió ARCA (comprobante interno) → no usar overlay
      // Se podría informar por UI normal si se desea; aquí no abrimos/cerramos overlay
    } else if (resultado?.error) {
      // Error específico del backend → no iniciar overlay aquí
    } else {
      // Resultado no reconocido → no iniciar overlay
    }
  }, [esperandoArca, iniciarEsperaArca, finalizarEsperaArcaExito]);

  /**
   * Maneja errores de la operación, asegurando que se muestren en el modal de ARCA
   * @param {Error} error - Error capturado
   * @param {string} mensajePorDefecto - Mensaje por defecto si no hay error.message
   */
  const manejarErrorArca = useCallback((error, mensajePorDefecto = "Error al procesar la operación") => {
    console.error("Error en operación:", error);
    
    // Mostrar en overlay SOLO si ya se estaba esperando ARCA
    if (esperandoArca) {
      finalizarEsperaArcaError(error.message || mensajePorDefecto);
    } else {
      // Error no relacionado a ARCA: mostrar como alerta estándar y NO abrir overlay
      const mensaje = (error && error.message) ? error.message : mensajePorDefecto;
      try {
        window.alert(mensaje);
      } catch (_) {
        // Entorno sin window (por seguridad): no hacer nada extra
      }
    }
  }, [esperandoArca, finalizarEsperaArcaError]);

  /**
   * Crea una función personalizada para aceptar resultado de ARCA
   * @param {Function} aceptarResultadoArca - Función del hook useArcaEstado
   * @param {Function} onCancel - Función para cerrar el formulario
   * @param {Function} getRespuestaArca - Función que retorna el estado actual de respuestaArca
   * @param {Function} getErrorArca - Función que retorna el estado actual de errorArca
   * @returns {Function} Función que maneja la aceptación del resultado
   */
  const crearHandleAceptarResultadoArca = useCallback((aceptarResultadoArca, onCancel, getRespuestaArca, getErrorArca) => {
    return () => {
      aceptarResultadoArca();
      
      // Evaluar el estado actual en tiempo de ejecución
      const respuestaArcaActual = getRespuestaArca();
      const errorArcaActual = getErrorArca();
      
      // Solo cerrar si fue exitoso (tiene respuestaArca), no si fue error
      if (respuestaArcaActual && !errorArcaActual) {
        onCancel();
      }
      // Si es error (errorArca), NO cerrar el formulario para permitir corrección
    };
  }, []);

  return {
    procesarResultadoArca,
    manejarErrorArca,
    crearHandleAceptarResultadoArca
  };
}; 