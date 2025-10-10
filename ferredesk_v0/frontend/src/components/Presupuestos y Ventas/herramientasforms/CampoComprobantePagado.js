import React from 'react'

/**
 * Componente modularizado para el campo de comprobante pagado
 * Permite marcar una venta como "Factura Recibo" ingresando un monto de pago
 * 
 * Props:
 * - formulario: objeto con montoPago
 * - handleChange: función para manejar cambios
 * - totales: objeto con el total de la venta
 * - isReadOnly: boolean para deshabilitar el campo
 */
const CampoComprobantePagado = ({ 
  formulario, 
  handleChange, 
  totales, 
  isReadOnly = false 
}) => {
  // Determinar si está pagado basado en el monto (no en checkbox)
  const estaPagado = formulario.montoPago && parseFloat(formulario.montoPago) > 0

  return (
    <>
      {/* Monto del Pago */}
      <div>
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">
          Monto del Pago {estaPagado && <span className="text-orange-600">*</span>}
        </label>
        <input
          name="montoPago"
          type="number"
          step="0.01"
          min="0"
          value={formulario.montoPago || ''}
          onChange={handleChange}
          className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={isReadOnly}
          placeholder="0.00"
        />
      </div>
    </>
  )
}

export default CampoComprobantePagado
