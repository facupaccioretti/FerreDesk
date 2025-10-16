"use client"

import { useState, useEffect } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteAPI from "../../utils/useCuentaCorrienteAPI"

const ImputacionesModal = ({ modal, onClose, onGuardar }) => {
  const theme = useFerreDeskTheme()
  const { crearReciboConImputaciones } = useCuentaCorrienteAPI()
  
  const [formData, setFormData] = useState({
    rec_fecha: new Date().toISOString().split('T')[0],
    rec_monto_total: 0,
    rec_observacion: '',
    rec_tipo: 'recibo',
    imputaciones: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calcular monto total de imputaciones
  const montoImputaciones = formData.imputaciones.reduce((total, imp) => total + (imp.monto || 0), 0)

  // Actualizar monto total cuando cambien las imputaciones
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      rec_monto_total: montoImputaciones
    }))
  }, [montoImputaciones])

  const handleImputacionChange = (facturaId, monto) => {
    setFormData(prev => ({
      ...prev,
      imputaciones: prev.imputaciones.map(imp => 
        imp.factura_id === facturaId 
          ? { ...imp, monto: parseFloat(monto) || 0 }
          : imp
      )
    }))
  }

  const handleGuardar = async () => {
    if (!modal.recibo) return

    setLoading(true)
    setError('')

    try {
      // Validar que el monto total sea mayor o igual a las imputaciones
      if (formData.rec_monto_total < montoImputaciones) {
        throw new Error('El monto del recibo no puede ser menor al monto de las imputaciones')
      }

      // Preparar datos para enviar
      const reciboData = {
        rec_fecha: formData.rec_fecha,
        rec_monto_total: formData.rec_monto_total,
        rec_observacion: formData.rec_observacion,
        rec_tipo: formData.rec_tipo,
        cliente_id: modal.recibo.ven_idcli,
        imputaciones: formData.imputaciones
          .filter(imp => imp.monto > 0)
          .map(imp => ({
            imp_id_venta: imp.factura_id,
            imp_fecha: formData.rec_fecha,
            imp_monto: imp.monto,
            imp_observacion: ''
          }))
      }

      const response = await crearReciboConImputaciones(reciboData)
      
      // Mostrar mensaje de éxito
      const tipoComprobante = formData.rec_tipo === 'credito' ? 'Nota de Crédito' : 'Recibo'
      alert(`${tipoComprobante} creado exitosamente: ${response.numero_recibo}`)
      
      // Cerrar modal y recargar datos
      onGuardar()
    } catch (err) {
      setError(err.message || 'Error al crear el recibo')
    } finally {
      setLoading(false)
    }
  }

  // Inicializar imputaciones cuando se abre el modal
  useEffect(() => {
    if (modal.abierto && modal.facturasPendientes.length > 0) {
      setFormData(prev => ({
        ...prev,
        imputaciones: modal.facturasPendientes.map(factura => ({
          factura_id: factura.ven_id,
          numero: factura.numero_formateado,
          fecha: factura.ven_fecha,
          monto_original: factura.ven_total,
          saldo_pendiente: factura.saldo_pendiente,
          monto: 0
        }))
      }))
    }
  }, [modal.abierto, modal.facturasPendientes])

  if (!modal.abierto) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${theme.fuente}`}>
              Imputaciones
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Información del recibo */}
          {modal.recibo && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-blue-800 mb-2">
                Información del {modal.recibo.comprobante_tipo === 'credito' ? 'Crédito' : 'Recibo'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Comprobante:</span>
                  <div className="text-blue-800">{modal.recibo.numero_formateado}</div>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Fecha:</span>
                  <div className="text-blue-800">
                    {new Date(modal.recibo.ven_fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                  </div>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Importe:</span>
                  <div className="text-blue-800 font-bold">
                    ${modal.recibo.ven_total?.toLocaleString('es-AR') || '0'}
                  </div>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">A Imputar:</span>
                  <div className="text-blue-800 font-bold">
                    ${montoImputaciones.toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Formulario del recibo */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-slate-800 mb-4">
              Datos del {modal.recibo?.comprobante_tipo === 'credito' ? 'Crédito' : 'Recibo'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={formData.rec_fecha}
                  onChange={(e) => setFormData(prev => ({ ...prev, rec_fecha: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monto Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={montoImputaciones}
                  value={formData.rec_monto_total}
                  onChange={(e) => setFormData(prev => ({ ...prev, rec_monto_total: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Mínimo: ${montoImputaciones.toLocaleString('es-AR')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo
                </label>
                <select
                  value={formData.rec_tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, rec_tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="recibo">Recibo</option>
                  <option value="credito">Nota de Crédito</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observación
                </label>
                <input
                  type="text"
                  value={formData.rec_observacion}
                  onChange={(e) => setFormData(prev => ({ ...prev, rec_observacion: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observaciones del recibo..."
                />
              </div>
            </div>
          </div>

          {/* Tabla de facturas a imputar */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-800">
                Comprobantes a Imputar
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Comprobante
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Imputado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Pago Actual
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {formData.imputaciones.map((imputacion, index) => (
                    <tr key={imputacion.factura_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        {new Date(imputacion.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        {imputacion.numero}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-900">
                        ${imputacion.monto_original.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-900">
                        ${(imputacion.monto_original - imputacion.saldo_pendiente).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={imputacion.saldo_pendiente}
                          value={imputacion.monto}
                          onChange={(e) => handleImputacionChange(imputacion.factura_id, e.target.value)}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen de montos */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  Monto Total a Imputar:
                </div>
                <div className="text-lg font-bold text-slate-800">
                  ${montoImputaciones.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mr-3">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading || montoImputaciones === 0 || formData.rec_monto_total < montoImputaciones}
            className={`${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>✓ Aceptar</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImputacionesModal
