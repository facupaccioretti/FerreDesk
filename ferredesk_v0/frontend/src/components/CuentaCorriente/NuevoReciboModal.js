"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteAPI from "../../utils/useCuentaCorrienteAPI"

const NuevoReciboModal = ({ 
  modal, 
  onClose, 
  onGuardar,
  esReciboExcedente = false,  // Nuevo: indica si es recibo de excedente
  montoFijo = null            // Nuevo: monto fijo (no editable)
}) => {
  const theme = useFerreDeskTheme()
  const { getFacturasPendientes, crearReciboConImputaciones } = useCuentaCorrienteAPI()
  
  // Estados para las dos partes del modal
  // Si es recibo de excedente, saltamos directo al paso 2
  const [paso, setPaso] = useState(esReciboExcedente ? 2 : 1) // 1: Selección facturas, 2: Datos recibo
  
  // Estado para la primera parte: selección de facturas e imputaciones
  const [facturasPendientes, setFacturasPendientes] = useState([])
  const [imputaciones, setImputaciones] = useState([])
  
  // Estado para la segunda parte: datos del recibo
  const [formData, setFormData] = useState({
    rec_fecha: new Date().toISOString().split('T')[0],
    rec_pv: "",
    rec_numero: "",
    rec_monto_total: montoFijo || 0,  // Usar montoFijo si está disponible
    rec_observacion: '',
    rec_tipo: 'recibo'
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Constantes de clases FerreDesk
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_INPUT = "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
  const CLASES_BOTON_SECUNDARIO = "px-6 py-3 rounded-lg font-semibold shadow transition-all duration-200 bg-slate-200 text-slate-700 hover:bg-slate-300"

  // Calcular monto total de imputaciones
  const montoImputaciones = imputaciones.reduce((total, imp) => total + (imp.monto || 0), 0)

  const cargarFacturasPendientes = useCallback(async () => {
    try {
      console.log('Cargando facturas pendientes para cliente:', modal.clienteId)
      const response = await getFacturasPendientes(modal.clienteId)
      console.log('Respuesta de facturas pendientes:', response)
      setFacturasPendientes(response.facturas || [])
    } catch (err) {
      console.error('Error al cargar facturas pendientes:', err)
      setError('Error al cargar facturas pendientes')
    }
  }, [modal.clienteId, getFacturasPendientes])

  // Cargar facturas pendientes cuando se abre el modal
  // (solo si NO es recibo de excedente)
  useEffect(() => {
    if (modal.abierto && modal.clienteId && !esReciboExcedente) {
      cargarFacturasPendientes()
    }
  }, [modal.abierto, modal.clienteId, esReciboExcedente, cargarFacturasPendientes])

  // Inicializar imputaciones cuando se cargan las facturas
  useEffect(() => {
    if (facturasPendientes.length > 0) {
      setImputaciones(facturasPendientes.map(factura => ({
        factura_id: factura.ven_id,
        numero: factura.numero_formateado,
        fecha: factura.ven_fecha,
        monto_original: factura.ven_total,
        saldo_pendiente: factura.saldo_pendiente,
        monto: 0
      })))
    }
  }, [facturasPendientes])

  // Actualizar monto total del recibo cuando cambien las imputaciones
  // (solo si NO es recibo de excedente)
  useEffect(() => {
    if (!esReciboExcedente) {
      setFormData(prev => ({
        ...prev,
        rec_monto_total: montoImputaciones
      }))
    }
  }, [montoImputaciones, esReciboExcedente])

  const handleImputacionChange = (facturaId, monto) => {
    setImputaciones(prev => prev.map(imp => 
      imp.factura_id === facturaId 
        ? { ...imp, monto: parseFloat(monto) || 0 }
        : imp
    ))
  }

  const handlePaso1Aceptar = () => {
    // Permitir continuar sin imputaciones (recibo sin imputar)
    // Pasar a la segunda parte
    setPaso(2)
    setError('')
  }

  const handlePaso1Cancelar = () => {
    onClose()
  }

  const handlePaso2Aceptar = async () => {
    // Validaciones de la segunda parte
    if (!formData.rec_pv?.trim()) {
      setError('El punto de venta es obligatorio')
      return
    }
    if (!formData.rec_numero?.trim()) {
      setError('El número del recibo es obligatorio')
      return
    }

    // Si NO es recibo de excedente, validar contra imputaciones
    if (!esReciboExcedente) {
      if (formData.rec_monto_total < montoImputaciones) {
        setError('El monto del recibo no puede ser menor al monto de las imputaciones')
        return
      }

      // Monto mínimo de $0
      if (formData.rec_monto_total < 0) {
        setError('El monto del recibo no puede ser negativo')
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      if (esReciboExcedente) {
        // Modo recibo de excedente: no hacer request al backend
        // Solo devolver los datos para que se envíen junto con la venta
        const reciboData = {
          rec_fecha: formData.rec_fecha,
          rec_pv: formData.rec_pv,
          rec_numero: formData.rec_numero,
          rec_monto_total: montoFijo || formData.rec_monto_total,
          rec_observacion: formData.rec_observacion,
          rec_tipo: 'recibo'
        }
        
        onGuardar(reciboData)
      } else {
        // Modo normal: crear recibo inmediatamente
        const reciboData = {
          rec_fecha: formData.rec_fecha,
          rec_pv: formData.rec_pv,
          rec_numero: formData.rec_numero,
          rec_monto_total: formData.rec_monto_total,
          rec_observacion: formData.rec_observacion,
          rec_tipo: formData.rec_tipo,
          cliente_id: modal.clienteId,
          imputaciones: imputaciones
            .filter(imp => imp.monto > 0)
            .map(imp => ({
              imp_id_venta: imp.factura_id,
              imp_monto: imp.monto,
              imp_observacion: ''
            }))
        }

        const response = await crearReciboConImputaciones(reciboData)
        
        // Mostrar mensaje de éxito
        alert(`Recibo creado exitosamente: ${response.numero_recibo || formData.rec_numero}`)
        
        // Cerrar modal y recargar datos
        onGuardar()
      }
    } catch (err) {
      setError(err.message || 'Error al crear el recibo')
    } finally {
      setLoading(false)
    }
  }

  const handlePaso2Cancelar = () => {
    setPaso(1)
    setError('')
  }

  const resetearModal = () => {
    setPaso(1)
    setFacturasPendientes([])
    setImputaciones([])
    setFormData({
      rec_fecha: new Date().toISOString().split('T')[0],
      rec_pv: "",
      rec_numero: "",
      rec_monto_total: 0,
      rec_observacion: '',
      rec_tipo: 'recibo'
    })
    setError('')
  }

  // Resetear cuando se cierra el modal
  useEffect(() => {
    if (!modal.abierto) {
      resetearModal()
    }
  }, [modal.abierto])

  return (
    <Transition show={modal.abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Fondo oscuro */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        {/* Panel del modal */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-6xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                <Dialog.Title className="text-lg font-bold text-white">
                  Nuevo Recibo - Paso {paso} de 2
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="text-slate-200 hover:text-white transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido */}
              <div className="px-6 py-4 overflow-y-auto flex-1">
                {/* PASO 1: Selección de facturas e imputaciones */}
                {paso === 1 && (
                  <>
                    <div className={`${CLASES_TARJETA} mb-4`}>
                      <div className={CLASES_ETIQUETA}>Paso 1: Seleccionar facturas e imputaciones</div>
                      <p className="text-sm text-slate-600 mt-2">
                        Seleccione las facturas y escriba los montos a imputar en la columna "Pago Actual". 
                        <br />
                        <strong>Puede omitir este paso para crear un recibo sin imputaciones.</strong>
                      </p>
                    </div>

                    {/* Tabla de facturas a imputar */}
                    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Facturas/Cotizaciones Sin Imputar
                        </h3>
                      </div>
                
                {imputaciones.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                      No hay facturas pendientes
                    </h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-4">
                      Este cliente no tiene facturas o cotizaciones sin imputar o parcialmente imputadas.
                    </p>
                    <p className="text-slate-600 max-w-md mx-auto font-medium">
                      Puede crear un recibo sin imputaciones que quedará como saldo disponible para futuras facturas.
                    </p>
                  </div>
                ) : (
                  <>
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
                          {imputaciones.map((imputacion, index) => (
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
                                  className="w-24 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right"
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
                            <div className={CLASES_ETIQUETA}>Monto total a imputar</div>
                            <div className="text-lg font-bold text-slate-800">
                              ${montoImputaciones.toLocaleString('es-AR')}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

                {/* PASO 2: Datos del recibo */}
                {paso === 2 && (
                  <>
                    {/* Resumen de imputaciones */}
                    {montoImputaciones > 0 && (
                      <div className={`${CLASES_TARJETA} mb-4 bg-blue-50 border-blue-200`}>
                        <div className={CLASES_ETIQUETA}>Resumen de imputaciones</div>
                        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                          <div>
                            <span className="text-blue-600 font-medium">Facturas:</span>
                            <div className="text-blue-800">{imputaciones.filter(imp => imp.monto > 0).length}</div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Monto a Imputar:</span>
                            <div className="text-blue-800 font-bold">
                              ${montoImputaciones.toLocaleString('es-AR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Formulario del recibo */}
                    <div className={CLASES_TARJETA}>
                      <div className={CLASES_ETIQUETA}>Datos del recibo</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <label className={CLASES_ETIQUETA}>Letra</label>
                          <input
                            type="text"
                            value="X"
                            readOnly
                            className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 bg-slate-100 text-center"
                            title="Letra fija"
                          />
                        </div>
                        <div>
                          <label className={CLASES_ETIQUETA}>PV *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formData.rec_pv}
                            onChange={(e) => {
                              const clean = (e.target.value || "").replace(/\D+/g, "").slice(0, 4)
                              setFormData(prev => ({ ...prev, rec_pv: clean }))
                            }}
                            onBlur={() => setFormData(prev => ({ ...prev, rec_pv: (prev.rec_pv || "").toString().padStart(4, "0") }))}
                            placeholder="0001"
                            className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center"
                            title="Punto de venta (4 dígitos)"
                          />
                        </div>
                        <div>
                          <label className={CLASES_ETIQUETA}>Número *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formData.rec_numero}
                            onChange={(e) => {
                              const clean = (e.target.value || "").replace(/\D+/g, "").slice(0, 8)
                              setFormData(prev => ({ ...prev, rec_numero: clean }))
                            }}
                            onBlur={() => setFormData(prev => ({ ...prev, rec_numero: (prev.rec_numero || "").toString().padStart(8, "0") }))}
                            placeholder="00000001"
                            className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center"
                            title="Número (8 dígitos)"
                          />
                        </div>
                        <div>
                          <label className={CLASES_ETIQUETA}>Vista previa</label>
                          <div className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 bg-slate-50 text-center flex items-center justify-center">
                            <span className="font-semibold">X {(formData.rec_pv || '').toString().padStart(4,'0')}-{(formData.rec_numero || '').toString().padStart(8,'0')}</span>
                          </div>
                        </div>
                        <div>
                          <label className={CLASES_ETIQUETA}>Fecha *</label>
                          <input
                            type="date"
                            value={formData.rec_fecha}
                            onChange={(e) => setFormData(prev => ({ ...prev, rec_fecha: e.target.value }))}
                            className={CLASES_INPUT}
                          />
                        </div>
                        <div>
                          <label className={CLASES_ETIQUETA}>Monto total *</label>
                          <input
                            type="number"
                            step="0.01"
                            min={esReciboExcedente ? montoFijo : Math.max(montoImputaciones, 0)}
                            value={esReciboExcedente ? (montoFijo ? Number(montoFijo).toFixed(2) : '') : formData.rec_monto_total}
                            onChange={esReciboExcedente ? undefined : (e) => setFormData(prev => ({ ...prev, rec_monto_total: parseFloat(e.target.value) || 0 }))}
                            disabled={esReciboExcedente}
                            className={`${CLASES_INPUT} ${esReciboExcedente ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          />
                          {!esReciboExcedente && (
                            <p className="text-xs text-slate-500 mt-1">
                              Mínimo: ${Math.max(montoImputaciones, 0).toLocaleString('es-AR')}
                            </p>
                          )}
                          {esReciboExcedente && (
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                              Monto fijo (excedente del pago)
                            </p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className={CLASES_ETIQUETA}>Observación</label>
                          <input
                            type="text"
                            value={formData.rec_observacion}
                            onChange={(e) => setFormData(prev => ({ ...prev, rec_observacion: e.target.value }))}
                            className={CLASES_INPUT}
                            placeholder="Observaciones del recibo..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mostrar monto extra si hay */}
                    {formData.rec_monto_total > montoImputaciones && (
                      <div className={`${CLASES_TARJETA} mt-4 bg-green-50 border-green-200`}>
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <div className={`${CLASES_ETIQUETA} text-green-600`}>
                              Monto extra sin imputar
                            </div>
                            <div className="text-lg font-bold text-green-900">
                              ${(formData.rec_monto_total - montoImputaciones).toLocaleString('es-AR')}
                            </div>
                            <div className="text-xs text-green-700">
                              Este monto podrá ser imputado a otras facturas en el futuro
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Mensaje de error */}
                {error && (
                  <div className={`${CLASES_TARJETA} mt-4 bg-red-50 border-red-200`}>
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mr-3">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      <span className="text-red-700 text-sm">{error}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between">
                <div>
                  {paso === 2 && !esReciboExcedente && (
                    <button
                      onClick={handlePaso2Cancelar}
                      className={CLASES_BOTON_SECUNDARIO}
                    >
                      ← Volver
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={paso === 1 ? handlePaso1Cancelar : onClose}
                    className={CLASES_BOTON_SECUNDARIO}
                  >
                    Cancelar
                  </button>
                  {paso === 1 ? (
                    <button
                      onClick={handlePaso1Aceptar}
                      className={theme.botonPrimario}
                    >
                      Continuar →
                    </button>
                  ) : (
                    <button
                      onClick={handlePaso2Aceptar}
                      disabled={
                        loading ||
                        !formData.rec_pv?.trim() ||
                        !formData.rec_numero?.trim() ||
                        (esReciboExcedente 
                          ? (montoFijo || 0) < 0 
                          : formData.rec_monto_total < Math.max(montoImputaciones, 0))
                      }
                      className={`${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Crear Recibo
                    </button>
                  )}
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default NuevoReciboModal
