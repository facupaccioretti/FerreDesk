import { useState, useCallback } from 'react';

/**
 * Hook personalizado para manejar el estado de espera de respuesta de ARCA
 * Detecta cuando un formulario está esperando la respuesta de AFIP para obtener el CAE
 */
export const useArcaEstado = () => {
  // Estado de espera de ARCA
  const [esperandoArca, setEsperandoArca] = useState(false);
  
  // Estado de la respuesta de ARCA
  const [respuestaArca, setRespuestaArca] = useState(null);
  
  // Estado de error de ARCA
  const [errorArca, setErrorArca] = useState(null);

  /**
   * Función para iniciar el estado de espera de ARCA
   * Se llama cuando se envía un formulario que requiere emisión fiscal
   */
  const iniciarEsperaArca = useCallback(() => {
    setEsperandoArca(true);
    setRespuestaArca(null);
    setErrorArca(null);
  }, []);

  /**
   * Función para finalizar el estado de espera de ARCA con éxito
   * Se llama cuando ARCA responde exitosamente
   */
  const finalizarEsperaArcaExito = useCallback((datos) => {
    setEsperandoArca(false);
    setRespuestaArca(datos);
    setErrorArca(null);
  }, []);

  /**
   * Función para finalizar el estado de espera de ARCA con error
   * Se llama cuando ARCA responde con error
   */
  const finalizarEsperaArcaError = useCallback((error) => {
    setEsperandoArca(false);
    setRespuestaArca(null);
    setErrorArca(error);
  }, []);

  /**
   * Función para limpiar el estado de ARCA
   * Se llama cuando se cierra el formulario o se cancela la operación
   */
  const limpiarEstadoArca = useCallback(() => {
    setEsperandoArca(false);
    setRespuestaArca(null);
    setErrorArca(null);
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

  return {
    // Estados
    esperandoArca,
    respuestaArca,
    errorArca,
    
    // Funciones de control
    iniciarEsperaArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    limpiarEstadoArca,
    requiereEmisionArca,
    
    // Estados derivados
    tieneRespuestaArca: !!respuestaArca,
    tieneErrorArca: !!errorArca,
    estaProcesando: esperandoArca,
  };
}; 