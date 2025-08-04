import { useState, useEffect } from 'react';

// Constantes para tipos de documento
const TIPOS_DOCUMENTO = {
  CUIT: 'cuit',
  DNI: 'dni'
};

/**
 * Hook ultra-simplificado para manejo de documentos fiscales (CUIT/DNI)
 * Sin validaciones automáticas para evitar re-renderizados
 */
export function useDocumentoFiscal({
  valorInicial = '',
  tipoInicial = TIPOS_DOCUMENTO.CUIT
}) {
  // Solo estados básicos, sin validaciones
  const [tipoDocumento, setTipoDocumento] = useState(tipoInicial);
  const [valorDocumento, setValorDocumento] = useState(valorInicial);

  // Sincronizar con las props cuando cambien
  useEffect(() => {
    setTipoDocumento(tipoInicial);
  }, [tipoInicial]);

  useEffect(() => {
    setValorDocumento(valorInicial);
  }, [valorInicial]);

  // Función simple para cambiar el tipo
  const cambiarTipoDocumento = (nuevoTipo) => {
    if (nuevoTipo === tipoDocumento) return;
    setTipoDocumento(nuevoTipo);
    setValorDocumento(''); // Limpiar valor al cambiar tipo
  };

  // Función simple para cambiar el valor
  const cambiarValorDocumento = (nuevoValor) => {
    setValorDocumento(nuevoValor);
  };

  // Función para obtener el valor limpio
  const obtenerValorLimpio = () => {
    if (tipoDocumento === TIPOS_DOCUMENTO.CUIT) {
      return valorDocumento.replace(/[-\s]/g, '');
    }
    return valorDocumento.replace(/[.\s]/g, '');
  };

  return {
    // Estados básicos
    tipoDocumento,
    valorDocumento,
    
    // Funciones básicas
    cambiarTipoDocumento,
    cambiarValorDocumento,
    obtenerValorLimpio,
    
    // Constantes
    TIPOS_DOCUMENTO,
    
    // Propiedades computadas simples
    esCUIT: tipoDocumento === TIPOS_DOCUMENTO.CUIT,
    esDNI: tipoDocumento === TIPOS_DOCUMENTO.DNI,
    tieneError: false, // Sin errores automáticos
    esObligatorio: false // Sin validaciones automáticas
  };
} 