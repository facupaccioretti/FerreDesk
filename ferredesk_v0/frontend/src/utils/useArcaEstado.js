import { useState, useCallback } from 'react';

/**
 * Hook personalizado para manejar el estado de espera de respuesta de ARCA
 * Detecta cuando un formulario está esperando la respuesta de AFIP para obtener el CAE
 * Mejorado para mayor consistencia y funcionalidad
 */
export const useArcaEstado = () => {
  // Estado de espera de ARCA
  const [esperandoArca, setEsperandoArca] = useState(false);
  
  // Estado de la respuesta de ARCA
  const [respuestaArca, setRespuestaArca] = useState(null);
  
  // Estado de error de ARCA
  const [errorArca, setErrorArca] = useState(null);

  // Estado de progreso (opcional para futuras mejoras)
  const [progresoArca, setProgresoArca] = useState(0);

  /**
   * Función para iniciar el estado de espera de ARCA
   * Se llama cuando se envía un formulario que requiere emisión fiscal
   */
  const iniciarEsperaArca = useCallback(() => {
    setEsperandoArca(true);
    setRespuestaArca(null);
    setErrorArca(null);
    setProgresoArca(0);
  }, []);

  /**
   * Función para finalizar el estado de espera de ARCA con éxito
   * Se llama cuando ARCA responde exitosamente
   */
  const finalizarEsperaArcaExito = useCallback((datos) => {
    setEsperandoArca(false);
    setRespuestaArca(datos);
    setErrorArca(null);
    setProgresoArca(100);
  }, []);

  /**
   * Función para finalizar el estado de espera de ARCA con error
   * Se llama cuando ARCA responde con error
   */
  const finalizarEsperaArcaError = useCallback((error) => {
    setEsperandoArca(false);
    setRespuestaArca(null);
    setErrorArca(error);
    setProgresoArca(0);
  }, []);

  /**
   * Función para limpiar el estado de ARCA
   * Se llama cuando se cierra el formulario o se cancela la operación
   */
  const limpiarEstadoArca = useCallback(() => {
    setEsperandoArca(false);
    setRespuestaArca(null);
    setErrorArca(null);
    setProgresoArca(0);
  }, []);

  /**
   * Función para manejar el cierre del overlay cuando el usuario hace clic en "Aceptar"
   * Se llama cuando el usuario acepta el resultado (éxito o error) del ARCA
   */
  const aceptarResultadoArca = useCallback(() => {
    // Limpiar el estado para cerrar el overlay
    limpiarEstadoArca();
  }, [limpiarEstadoArca]);

  /**
   * Función para actualizar el progreso (para futuras mejoras)
   */
  const actualizarProgresoArca = useCallback((progreso) => {
    setProgresoArca(progreso);
  }, []);

  /**
   * Función para verificar si un tipo de comprobante requiere emisión ARCA
   * @param {string} tipoComprobante - Tipo de comprobante ('factura', 'factura_interna', etc.)
   * @returns {boolean} - True si requiere emisión ARCA
   */
  const requiereEmisionArca = useCallback((tipoComprobante) => {
    // Solo las facturas fiscales y notas de crédito fiscales requieren emisión ARCA
    const tiposQueRequierenArca = ['factura', 'nota_credito'];
    return tiposQueRequierenArca.includes(tipoComprobante?.toLowerCase());
  }, []);

  /**
   * Función para obtener mensaje personalizado según el tipo de comprobante
   * @param {string} tipoComprobante - Tipo de comprobante
   * @returns {string} - Mensaje personalizado
   */
  const obtenerMensajePersonalizado = useCallback((tipoComprobante) => {
    const mensajes = {
      'factura': 'Esperando autorización...',
      'nota_credito': 'Esperando autorización...',
      'default': 'Esperando respuesta para obtener el CAE...'
    };
    
    return mensajes[tipoComprobante?.toLowerCase()] || mensajes.default;
  }, []);

  return {
    // Estados
    esperandoArca,
    respuestaArca,
    errorArca,
    progresoArca,
    
    // Funciones de control
    iniciarEsperaArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    limpiarEstadoArca,
    aceptarResultadoArca,
    actualizarProgresoArca,
    requiereEmisionArca,
    obtenerMensajePersonalizado,
    
    // Estados derivados
    tieneRespuestaArca: !!respuestaArca,
    tieneErrorArca: !!errorArca,
    estaProcesando: esperandoArca,
    estaCompletado: progresoArca === 100,
  };
}; 