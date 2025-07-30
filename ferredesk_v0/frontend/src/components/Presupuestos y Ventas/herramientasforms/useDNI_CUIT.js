import { useState, useEffect, useCallback } from 'react';

// Constantes para tipos de documento
const TIPOS_DOCUMENTO = {
  CUIT: 'cuit',
  DNI: 'dni'
};

// Validaciones específicas por tipo de documento
const validadoresDocumento = {
  [TIPOS_DOCUMENTO.CUIT]: (valor) => {
    if (!valor) return false;
    const cuitLimpio = valor.replace(/[-\s]/g, '');
    return /^\d{11}$/.test(cuitLimpio);
  },
  [TIPOS_DOCUMENTO.DNI]: (valor) => {
    if (!valor) return false;
    const dniLimpio = valor.replace(/[.\s]/g, '');
    return /^\d{7,8}$/.test(dniLimpio);
  }
};

// Mensajes de error por tipo de documento
const mensajesErrorDocumento = {
  [TIPOS_DOCUMENTO.CUIT]: 'El CUIT debe tener 11 dígitos',
  [TIPOS_DOCUMENTO.DNI]: 'El DNI debe tener 7 u 8 dígitos'
};

// Formateadores para mostrar el documento
const formateadoresDocumento = {
  [TIPOS_DOCUMENTO.CUIT]: (valor) => {
    if (!valor) return '';
    const cuitLimpio = valor.replace(/[-\s]/g, '');
    if (cuitLimpio.length === 11) {
      return `${cuitLimpio.slice(0, 2)}-${cuitLimpio.slice(2, 10)}-${cuitLimpio.slice(10)}`;
    }
    return valor;
  },
  [TIPOS_DOCUMENTO.DNI]: (valor) => {
    if (!valor) return '';
    const dniLimpio = valor.replace(/[.\s]/g, '');
    if (dniLimpio.length >= 7) {
      return dniLimpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return valor;
  }
};

/**
 * Hook para manejo de documentos fiscales (CUIT/DNI)
 * 
 * PROPÓSITO:
 * - Centralizar la lógica de validación de documentos
 * - Manejar el cambio entre CUIT y DNI
 * - Proporcionar validaciones en tiempo real
 * - Integrar con el sistema fiscal existente
 * 
 * @param {Object} config - Configuración del hook
 * @param {string} config.tipoComprobante - Tipo de comprobante (A, B, C)
 * @param {boolean} config.esObligatorio - Si el documento es obligatorio según el comprobante
 * @param {string} config.valorInicial - Valor inicial del documento
 * @param {string} config.tipoInicial - Tipo inicial (cuit o dni)
 */
export function useDocumentoFiscal({
  tipoComprobante,
  esObligatorio = false,
  valorInicial = '',
  tipoInicial = TIPOS_DOCUMENTO.CUIT
}) {
  // Estados principales
  const [tipoDocumento, setTipoDocumento] = useState(tipoInicial);
  const [valorDocumento, setValorDocumento] = useState(valorInicial);
  const [esValido, setIsValido] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [estaModificado, setEstaModificado] = useState(false);

  // Función para validar el documento actual
  const validarDocumento = useCallback((valor, tipo) => {
    if (!esObligatorio) {
      setIsValido(true);
      setMensajeError('');
      return;
    }

    if (!valor || !valor.trim()) {
      setIsValido(false);
      setMensajeError(''); // No mostrar mensaje de obligatorio, solo el asterisco rojo
      return;
    }

    const validador = validadoresDocumento[tipo];
    const esValidoActual = validador(valor);

    setIsValido(esValidoActual);
    setMensajeError(esValidoActual ? '' : mensajesErrorDocumento[tipo]);
  }, [esObligatorio]);

  // Función para cambiar el tipo de documento
  const cambiarTipoDocumento = useCallback((nuevoTipo) => {
    if (nuevoTipo === tipoDocumento) return;

    setTipoDocumento(nuevoTipo);
    setValorDocumento(''); // Limpiar valor al cambiar tipo
    setEstaModificado(true);
    validarDocumento('', nuevoTipo);
  }, [tipoDocumento, validarDocumento]);

  // Función para cambiar el valor del documento
  const cambiarValorDocumento = useCallback((nuevoValor) => {
    setValorDocumento(nuevoValor);
    setEstaModificado(true);
    validarDocumento(nuevoValor, tipoDocumento);
  }, [tipoDocumento, validarDocumento]);

  // Función para obtener el valor formateado para mostrar
  const obtenerValorFormateado = useCallback(() => {
    const formateador = formateadoresDocumento[tipoDocumento];
    return formateador(valorDocumento);
  }, [valorDocumento, tipoDocumento]);

  // Función para obtener el valor limpio para enviar al backend
  const obtenerValorLimpio = useCallback(() => {
    if (tipoDocumento === TIPOS_DOCUMENTO.CUIT) {
      return valorDocumento.replace(/[-\s]/g, '');
    }
    return valorDocumento.replace(/[.\s]/g, '');
  }, [valorDocumento, tipoDocumento]);

  // Función para resetear el estado
  const resetearDocumento = useCallback(() => {
    setTipoDocumento(tipoInicial);
    setValorDocumento(valorInicial);
    setEstaModificado(false);
    validarDocumento(valorInicial, tipoInicial);
  }, [tipoInicial, valorInicial, validarDocumento]);

  // Función para forzar actualización desde componente padre
  const actualizarDocumento = useCallback((nuevoTipo, nuevoValor) => {
    setTipoDocumento(nuevoTipo);
    setValorDocumento(nuevoValor);
    setEstaModificado(false);
    validarDocumento(nuevoValor, nuevoTipo);
  }, [validarDocumento]);

  // Efecto para validar cuando cambia el tipo de comprobante
  useEffect(() => {
    validarDocumento(valorDocumento, tipoDocumento);
  }, [tipoComprobante, validarDocumento, valorDocumento, tipoDocumento]);

  // Efecto para inicializar con valores por defecto
  useEffect(() => {
    if (!estaModificado) {
      validarDocumento(valorInicial, tipoInicial);
    }
  }, [valorInicial, tipoInicial, estaModificado, validarDocumento]);

  return {
    // Estados
    tipoDocumento,
    valorDocumento,
    esValido,
    mensajeError,
    estaModificado,
    
    // Funciones
    cambiarTipoDocumento,
    cambiarValorDocumento,
    obtenerValorFormateado,
    obtenerValorLimpio,
    resetearDocumento,
    actualizarDocumento,
    
    // Constantes
    TIPOS_DOCUMENTO,
    
    // Propiedades computadas
    esCUIT: tipoDocumento === TIPOS_DOCUMENTO.CUIT,
    esDNI: tipoDocumento === TIPOS_DOCUMENTO.DNI,
    tieneError: !esValido && mensajeError !== '',
    esObligatorio
  };
} 