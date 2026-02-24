"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { formatearFecha } from "../../utils/formatters"

/**
 * Modal para mostrar el detalle completo de un cheque con historial.
 * 
 * @param {object} cheque - Cheque inicial (puede ser básico, se carga el detalle completo)
 * @param {function} onCerrar - Callback al cerrar el modal
 */
const ModalDetalleCheque = ({ cheque, onCerrar }) => {
  const theme = useFerreDeskTheme()
  const { obtenerDetalleCheque } = useCajaAPI()
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const cargarDetalle = useCallback(async () => {
    if (!cheque?.id) return
    setCargando(true)
    setError(null)
    try {
      const data = await obtenerDetalleCheque(cheque.id)
      setDetalle(data)
    } catch (err) {
      console.error("Error cargando detalle del cheque:", err)
      setError(err.message || "Error al cargar el detalle del cheque")
    } finally {
      setCargando(false)
    }
  }, [cheque?.id, obtenerDetalleCheque])

  useEffect(() => {
    if (cheque?.id) {
      cargarDetalle()
    }
  }, [cheque?.id, cargarDetalle])

  // Se usan formateadores centralizados de ../../utils/formatters

  const formatearFechaHora = (fechaHora) => {
    if (!fechaHora) return "-"
    const d = new Date(fechaHora)
    return d.toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatearCUIT = (cuit) => {
    if (!cuit || cuit.length !== 11) return cuit || "-"
    return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
  }

  const obtenerColorEstado = (estado) => {
    switch (estado) {
      case "EN_CARTERA":
        return "bg-blue-100 text-blue-700"
      case "DEPOSITADO":
        return "bg-green-100 text-green-700"
      case "ENTREGADO":
        return "bg-purple-100 text-purple-700"
      case "RECHAZADO":
        return "bg-red-100 text-red-700"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  const obtenerTextoEstado = (estado) => {
    switch (estado) {
      case "EN_CARTERA":
        return "En Cartera"
      case "DEPOSITADO":
        return "Depositado"
      case "ENTREGADO":
        return "Entregado (Endosado)"
      case "RECHAZADO":
        return "Rechazado"
      default:
        return estado
    }
  }

  const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
  const CLASES_VALOR = "text-sm text-slate-800 font-medium"

  return (
    <Transition show={!!cheque} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onCerrar}>
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
            <Dialog.Panel className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div
                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
              >
                <Dialog.Title className="text-lg font-bold text-white">
                  Detalle del Cheque
                </Dialog.Title>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="text-slate-200 hover:text-white transition-colors"
                  aria-label="Cerrar"
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
                {cargando && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-slate-500">Cargando detalle...</div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                  </div>
                )}

                {detalle && !cargando && (
                  <div className="space-y-4">
                    {/* Datos básicos */}
                    <div className={CLASES_TARJETA}>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Datos Básicos</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className={CLASES_ETIQUETA}>Número</div>
                          <div className={CLASES_VALOR}>{detalle.numero || "-"}</div>
                        </div>
                        <div>
                          <div className={CLASES_ETIQUETA}>Librador</div>
                          <div className={CLASES_VALOR}>{detalle.librador_nombre || "-"}</div>
                        </div>
                        <div>
                          <div className={CLASES_ETIQUETA}>CUIT Librador</div>
                          <div className={CLASES_VALOR}>{formatearCUIT(detalle.cuit_librador)}</div>
                        </div>
                        <div>
                          <div className={CLASES_ETIQUETA}>Tipo</div>
                          <div className={CLASES_VALOR}>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${detalle.tipo_cheque === "DIFERIDO" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                              }`}>
                              {detalle.tipo_cheque === "DIFERIDO" ? "Diferido" : "Al día"}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className={CLASES_ETIQUETA}>Fecha Emisión</div>
                          <div className={CLASES_VALOR}>{formatearFecha(detalle.fecha_emision)}</div>
                        </div>
                        <div>
                          <div className={CLASES_ETIQUETA}>Fecha de Pago</div>
                          <div className={CLASES_VALOR}>{formatearFecha(detalle.fecha_pago)}</div>
                        </div>
                        {detalle.fecha_vencimiento_calculada && (
                          <div>
                            <div className={CLASES_ETIQUETA}>Fecha Vencimiento</div>
                            <div className={CLASES_VALOR}>
                              {formatearFecha(detalle.fecha_vencimiento_calculada)}
                              {detalle.dias_hasta_vencimiento !== null && (
                                <span
                                  className={`ml-2 text-xs ${detalle.dias_hasta_vencimiento < 0
                                    ? "text-red-600"
                                    : detalle.dias_hasta_vencimiento <= 5
                                      ? "text-orange-600"
                                      : "text-slate-500"
                                    }`}
                                >
                                  ({detalle.dias_hasta_vencimiento > 0 ? "+" : ""}
                                  {detalle.dias_hasta_vencimiento} días)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Estado actual */}
                    <div className={CLASES_TARJETA}>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Estado Actual</h3>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${obtenerColorEstado(
                          detalle.estado
                        )}`}
                      >
                        {obtenerTextoEstado(detalle.estado)}
                      </span>
                    </div>

                    {/* Origen */}
                    {(detalle.cliente_origen || detalle.venta_id) && (
                      <div className={CLASES_TARJETA}>
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Origen</h3>
                        {detalle.cliente_origen && (
                          <div className="mb-2">
                            <div className={CLASES_ETIQUETA}>Cliente</div>
                            <div className={CLASES_VALOR}>{detalle.cliente_origen}</div>
                          </div>
                        )}
                        {detalle.venta_id && (
                          <div>
                            <div className={CLASES_ETIQUETA}>Venta ID</div>
                            <div className={CLASES_VALOR}>#{detalle.venta_id}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Destino actual */}
                    {(detalle.cuenta_banco_deposito_nombre || detalle.proveedor_nombre) && (
                      <div className={CLASES_TARJETA}>
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Destino Actual</h3>
                        {detalle.cuenta_banco_deposito_nombre && (
                          <div>
                            <div className={CLASES_ETIQUETA}>Cuenta Bancaria</div>
                            <div className={CLASES_VALOR}>{detalle.cuenta_banco_deposito_nombre}</div>
                          </div>
                        )}
                        {detalle.proveedor_nombre && (
                          <div>
                            <div className={CLASES_ETIQUETA}>Proveedor</div>
                            <div className={CLASES_VALOR}>{detalle.proveedor_nombre}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Nota de Débito */}
                    {detalle.nota_debito_numero_formateado && (
                      <div className={CLASES_TARJETA}>
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Nota de Débito</h3>
                        <div>
                          <div className={CLASES_ETIQUETA}>Número</div>
                          <div className={CLASES_VALOR}>{detalle.nota_debito_numero_formateado}</div>
                        </div>
                      </div>
                    )}

                    {/* Historial */}
                    {detalle.historial_estados && detalle.historial_estados.length > 0 && (
                      <div className={CLASES_TARJETA}>
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Historial</h3>
                        <div className="space-y-2">
                          {detalle.historial_estados.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-2 bg-slate-50 rounded border border-slate-200"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${obtenerColorEstado(
                                      item.estado
                                    )}`}
                                  >
                                    {item.estado_display}
                                  </span>
                                  {item.fecha && (
                                    <span className="text-xs text-slate-500">
                                      {formatearFecha(item.fecha)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600">{item.descripcion}</p>
                                {item.usuario && (
                                  <p className="text-xs text-slate-500 mt-1">Usuario: {item.usuario}</p>
                                )}
                                {item.fecha_hora && (
                                  <p className="text-xs text-slate-500">
                                    {formatearFechaHora(item.fecha_hora)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={onCerrar}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${theme.botonPrimario}`}
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

export default ModalDetalleCheque
