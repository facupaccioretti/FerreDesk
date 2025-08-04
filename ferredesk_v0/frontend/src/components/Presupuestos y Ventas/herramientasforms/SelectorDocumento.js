import React from 'react';
import { useDocumentoFiscal } from './useDNI_CUIT';

/**
 * Componente reutilizable para selección de documento fiscal (CUIT/DNI)
 * 
 * PROPÓSITO:
 * - Proporcionar una interfaz unificada para seleccionar entre CUIT y DNI
 * - Integrar con el sistema de validación fiscal existente
 * - Mantener consistencia visual con el resto de la aplicación
 * 
 * @param {Object} props - Propiedades del componente
 * @param {string} props.tipoComprobante - Tipo de comprobante (A, B, C)
 * @param {boolean} props.esObligatorio - Si el documento es obligatorio
 * @param {string} props.valorInicial - Valor inicial del documento
 * @param {string} props.tipoInicial - Tipo inicial (cuit o dni)
 * @param {Function} props.onChange - Callback cuando cambia el valor
 * @param {boolean} props.readOnly - Si el campo es de solo lectura
 * @param {string} props.className - Clases CSS adicionales
 */
const SelectorDocumento = ({
  tipoComprobante,
  esObligatorio = false,
  valorInicial = '',
  tipoInicial = 'cuit',
  onChange,
  readOnly = false,
  className = ''
}) => {
  const {
    tipoDocumento,
    valorDocumento,
    cambiarTipoDocumento,
    cambiarValorDocumento,

    TIPOS_DOCUMENTO,
    esCUIT,
    esDNI,
    tieneError,
    esObligatorio: esObligatorioHook
  } = useDocumentoFiscal({
    valorInicial,
    tipoInicial
  });

  // Función para manejar el cambio de tipo de documento
  const handleTipoChange = (nuevoTipo) => {
    if (readOnly) return;
    
    cambiarTipoDocumento(nuevoTipo);
    
    // Notificar al componente padre
    if (onChange) {
      onChange({
        tipo: nuevoTipo,
        valor: ''
      });
    }
  };

  // Función para manejar el cambio de valor del documento
  const handleValorChange = (evento) => {
    if (readOnly) return;
    
    const nuevoValor = evento.target.value;
    cambiarValorDocumento(nuevoValor);
    
    // Notificar al componente padre
    if (onChange) {
      onChange({
        tipo: tipoDocumento,
        valor: nuevoValor
      });
    }
  };

  // Función para manejar eventos de teclado
  const handleKeyDown = (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Radio buttons como título del campo */}
      <div className="flex items-center gap-4 mb-2">
        <label className="flex items-center gap-2 text-base font-semibold text-slate-700 cursor-pointer">
          <input
            type="radio"
            name="tipoDocumento"
            checked={esCUIT}
            onChange={() => handleTipoChange(TIPOS_DOCUMENTO.CUIT)}
            disabled={readOnly}
            className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
          />
          CUIT {esObligatorioHook && <span className="text-orange-600">*</span>}
        </label>
        
        <label className="flex items-center gap-2 text-base font-semibold text-slate-700 cursor-pointer">
          <input
            type="radio"
            name="tipoDocumento"
            checked={esDNI}
            onChange={() => handleTipoChange(TIPOS_DOCUMENTO.DNI)}
            disabled={readOnly}
            className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
          />
          DNI {esObligatorioHook && <span className="text-orange-600">*</span>}
        </label>
      </div>

      {/* Campo de entrada del documento */}
      <input
        type="text"
        value={valorDocumento}
        onChange={handleValorChange}
        onKeyDown={handleKeyDown}
        placeholder={esCUIT ? 'XX-XXXXXXXX-X' : 'XX.XXX.XXX'}
        className="compacto w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
        required={esObligatorioHook}
        readOnly={readOnly}
        aria-label={`Campo de ${esCUIT ? 'CUIT' : 'DNI'}`}
        aria-invalid={tieneError}
        aria-describedby={tieneError ? 'error-documento' : undefined}
      />

             {/* Sin mensajes de error automáticos */}
    </div>
  );
};

export default SelectorDocumento; 