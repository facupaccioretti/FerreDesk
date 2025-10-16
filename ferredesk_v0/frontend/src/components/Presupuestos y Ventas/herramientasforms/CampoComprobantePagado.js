import React, { useEffect, useState } from 'react'

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
  // Estado local para edición libre sin afectar cálculos hasta confirmar (blur o botón)
  const [valorLocal, setValorLocal] = useState('')

  // Sincronizar valor local cuando cambia el valor externo
  useEffect(() => {
    const v = formulario?.montoPago
    setValorLocal(v === undefined || v === null ? '' : String(v))
  }, [formulario?.montoPago])
  // Determinar si está pagado basado en el monto (no en checkbox)
  const estaPagado = formulario.montoPago && parseFloat(formulario.montoPago) > 0

  // Limitar decimales a 2
  const limitarDecimales2 = (texto) => {
    if (!texto) return ''
    const tieneSep = texto.includes('.') || texto.includes(',')
    if (!tieneSep) return texto
    const sep = texto.includes('.') ? '.' : ','
    const [ent, dec = ''] = texto.split(sep)
    return `${ent}${sep}${dec.slice(0, 2)}`
  }

  // Manejar escritura libre con saneo básico y un solo separador
  const handleInputChangeLocal = (e) => {
    const crudo = e.target.value || ''
    const soloValidos = crudo.replace(/[^0-9.,]/g, '')
    let out = ''
    let sepVisto = false
    for (const ch of soloValidos) {
      if (ch === '.' || ch === ',') {
        if (sepVisto) continue
        sepVisto = true
        out += ch
      } else {
        out += ch
      }
    }
    setValorLocal(limitarDecimales2(out))
  }

  // Propagar al formulario externo normalizando coma→punto y convirtiendo a número
  const propagarMonto = (texto) => {
    const normalizado = (texto || '').replace(',', '.')
    const numero = parseFloat(normalizado)
    const valorFinal = Number.isFinite(numero) ? numero : 0
    handleChange({ target: { name: 'montoPago', value: valorFinal } })
    // Reflejar formato de 2 decimales visualmente
    setValorLocal(Number.isFinite(numero) ? valorFinal.toFixed(2) : '')
  }

  return (
    <>
      {/* Monto del Pago */}
      <div>
        <label className="block text-[12px] font-semibold text-slate-700 mb-1">
          Monto del Pago {estaPagado && <span className="text-orange-600">*</span>}
        </label>
        <div className="flex gap-1 items-center">
          <input
            name="montoPago"
            type="text"
            inputMode="decimal"
            value={valorLocal}
            onChange={handleInputChangeLocal}
            onBlur={(e) => propagarMonto(e.target.value)}
            className="flex-1 border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={isReadOnly}
            placeholder="0.00"
          />
          <button
            type="button"
            onClick={() => {
              if (totales?.total) {
                const v = Number(totales.total).toFixed(2)
                setValorLocal(v)
                propagarMonto(v)
              }
            }}
            disabled={isReadOnly || !totales?.total}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed h-8 flex items-center justify-center min-w-[32px]"
            title="Autocompletar con el total de la venta"
          >
            =
          </button>
        </div>
      </div>
    </>
  )
}

export default CampoComprobantePagado
