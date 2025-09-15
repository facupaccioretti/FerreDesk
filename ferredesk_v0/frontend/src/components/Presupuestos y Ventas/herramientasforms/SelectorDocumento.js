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
      <div className="flex items-center gap-3 mb-0.5">
        <label className={`flex items-center gap-1 text-xs font-semibold ${readOnly ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'}`}>
          <input
            type="radio"
            name="tipoDocumento"
            checked={esCUIT}
            onChange={() => handleTipoChange(TIPOS_DOCUMENTO.CUIT)}
            disabled={readOnly}
            className={`w-2 h-2 border-slate-300 ${readOnly ? 'opacity-60 cursor-not-allowed' : 'text-orange-600 focus:ring-orange-500'}`}
          />
          CUIT {esObligatorioHook && <span className="text-orange-600">*</span>}
        </label>
        
        <label className={`flex items-center gap-1 text-xs font-semibold ${readOnly ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'}`}>
          <input
            type="radio"
            name="tipoDocumento"
            checked={esDNI}
            onChange={() => handleTipoChange(TIPOS_DOCUMENTO.DNI)}
            disabled={readOnly}
            className={`w-2 h-2 border-slate-300 ${readOnly ? 'opacity-60 cursor-not-allowed' : 'text-orange-600 focus:ring-orange-500'}`}
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
        className={`w-full border rounded-none px-2 py-1 text-xs h-8 transition-all duration-200 ${readOnly
          ? 'bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200 focus:ring-0 focus:border-slate-200'
          : 'bg-white border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'}`}
        required={esObligatorioHook}
        disabled={readOnly}
        aria-disabled={readOnly}
        tabIndex={readOnly ? -1 : 0}
        aria-label={`Campo de ${esCUIT ? 'CUIT' : 'DNI'}`}
        aria-invalid={tieneError}
        aria-describedby={tieneError ? 'error-documento' : undefined}
      />

             {/* Sin mensajes de error automáticos */}
    </div>
  );
};

export default SelectorDocumento; 