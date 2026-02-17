"use client"

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useCuentaCorrienteAPI from '../../utils/useCuentaCorrienteAPI'

function LabelValor({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || '-'}</span>
    </div>
  )
}

export default function ModalDetalleComprobante({ open, onClose, itemBase }) {
  const theme = useFerreDeskTheme()
  const { getDetalleComprobante, eliminarImputacion } = useCuentaCorrienteAPI()
  const [, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  // Constantes de clases FerreDesk
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"

  const venId = itemBase?.ven_id || itemBase?.id

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      if (!open || !venId) return
      setLoading(true)
      setError(null)
      try {
        const detalle = await getDetalleComprobante(venId)
        if (activo) setData(detalle)
      } catch (e) {
        console.error(e)
        if (activo) setError('No se pudo cargar el detalle. Mostrando información básica.')
      } finally {
        if (activo) setLoading(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [open, venId, getDetalleComprobante, setLoading])

  const cab = data?.cabecera || {
    numero_formateado: itemBase?.numero_formateado,
    comprobante_nombre: itemBase?.comprobante_nombre,
    ven_fecha: itemBase?.ven_fecha || itemBase?.fecha,
    cliente: {},
    observacion: ''
  }
  const resumen = data?.resumen_comprobante || { total: '0.00', imputado: '0.00' }
  const asociados = data?.asociados || []

  return (
    <Transition show={open} as={Fragment} appear>
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
            <Dialog.Panel className="w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden">
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                <Dialog.Title className="text-lg font-bold text-white">
                  {`${cab.comprobante_nombre} ${cab.numero_formateado}`}
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
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className={`${CLASES_TARJETA} mb-4 bg-amber-50 border-amber-200`}>
                    <p className="text-sm text-amber-700">{error}</p>
                  </div>
                )}

                {/* Cabecera */}
                <div className={`${CLASES_TARJETA} mb-4`}>
                  <div className={CLASES_ETIQUETA}>Información del comprobante</div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <LabelValor label="Fecha" value={cab.ven_fecha} />
                    <LabelValor label="Cliente" value={cab.cliente?.razon} />
                    <LabelValor label="CUIT" value={cab.cliente?.cuit} />
                  </div>
                </div>

                {/* Resumen comprobante */}
                <div className={`${CLASES_TARJETA} mb-4`}>
                  <div className={CLASES_ETIQUETA}>Resumen de montos</div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <LabelValor label="Total" value={`$${resumen.total}`} />
                    <LabelValor label="Imputado" value={`$${resumen.imputado}`} />
                  </div>
                </div>

                {/* Asociados */}
                <div className={CLASES_TARJETA}>
                  <div className={CLASES_ETIQUETA}>Asociados ({asociados.length})</div>
                  <div className="overflow-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className={`text-left border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                          <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">Comprobante</th>
                          <th className="px-4 py-2 text-[10px] uppercase tracking-wide text-white">Fecha</th>
                          <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-white">Total</th>
                          <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wide text-white">Imputado</th>
                          <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wide text-white">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asociados.length === 0 ? (
                          <tr><td className="py-3 text-slate-400 text-center" colSpan={5}>Sin asociados</td></tr>
                        ) : asociados.map((a, idx) => (
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium">
                              {`${a.comprobante_nombre} ${a.numero_formateado}`}
                            </td>
                            <td className="px-4 py-2">{a.fecha}</td>
                            <td className="px-4 py-2 text-right">${a.total}</td>
                            <td className="px-4 py-2 text-right">${a.imputado}</td>
                            <td className="px-4 py-2 text-center">
                              {a.imp_id && (
                                <button
                                  onClick={async () => {
                                    if (window.confirm('¿Está seguro de que desea anular esta imputación individual?')) {
                                      try {
                                        await eliminarImputacion(a.imp_id);
                                        // Refrescar datos
                                        const detalle = await getDetalleComprobante(venId);
                                        setData(detalle);
                                      } catch (e) {
                                        alert(e.message);
                                      }
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                                  title="Anular esta imputación"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
                <button
                  onClick={onClose}
                  className={theme.botonPrimario}
                >
                  Cerrar
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}


