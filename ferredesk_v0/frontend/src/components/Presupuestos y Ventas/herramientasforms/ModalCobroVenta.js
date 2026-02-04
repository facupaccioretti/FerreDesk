"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../../hooks/useFerreDeskTheme"
import useCajaAPI from "../../../utils/useCajaAPI"

/** ID del cliente Consumidor Final para validación de pago exacto */
const CLIENTE_CONSUMIDOR_FINAL_ID = "1"

/** Tolerancia en pesos para considerar "exacto" el pago (consumidor final) */
const TOLERANCIA_PESOS = 0.01

/**
 * Modal para registrar medios de pago al confirmar una venta.
 * Muestra total a pagar, permite cargar múltiples líneas (metodo + monto),
 * total ingresado, diferencia (vuelto/faltante) y destino del excedente.
 *
 * @param {Object} props
 * @param {boolean} props.abierto - Si el modal está visible
 * @param {number} props.totalVenta - Total a pagar de la venta
 * @param {string} [props.clienteId] - ID del cliente (para validación consumidor final)
 * @param {number} [props.montoPagoInicial] - Monto opcional para pre-cargar una línea en efectivo
 * @param {() => void} props.onClose - Callback al cerrar sin confirmar
 * @param {(datos: { pagos: Array<{metodo_pago_id: number, monto: number}>, monto_pago: number, excedente_destino?: string }) => void} props.onConfirmar - Callback al confirmar con los datos de cobro
 */
const ModalCobroVenta = ({
  abierto,
  totalVenta,
  clienteId,
  montoPagoInicial = 0,
  onClose,
  onConfirmar,
}) => {
  const theme = useFerreDeskTheme()
  const { obtenerMetodosPago } = useCajaAPI()

  const [metodosPago, setMetodosPago] = useState([])
  const [cargandoMetodos, setCargandoMetodos] = useState(false)
  const [lineasPago, setLineasPago] = useState([])
  const [excedenteDestino, setExcedenteDestino] = useState("vuelto")
  const [justificacionDiferencia, setJustificacionDiferencia] = useState("")
  const [justificacionExcedente, setJustificacionExcedente] = useState("")
  const [error, setError] = useState("")

  const totalVentaNum = Number(totalVenta) || 0
  const totalIngresado = lineasPago.reduce((sum, l) => sum + (Number(l.monto) || 0), 0)
  const diferencia = Math.round((totalIngresado - totalVentaNum) * 100) / 100
  const hayExcedente = diferencia > TOLERANCIA_PESOS
  const hayFaltante = diferencia < -TOLERANCIA_PESOS
  const esConsumidorFinal = String(clienteId) === CLIENTE_CONSUMIDOR_FINAL_ID

  const cargarMetodos = useCallback(async () => {
    setCargandoMetodos(true)
    setError("")
    try {
      const lista = await obtenerMetodosPago(true)
      setMetodosPago(Array.isArray(lista) ? lista : [])
    } catch (err) {
      setError(err.message || "Error al cargar métodos de pago")
      setMetodosPago([])
    } finally {
      setCargandoMetodos(false)
    }
  }, [obtenerMetodosPago])

  useEffect(() => {
    if (abierto) {
      cargarMetodos()
    }
  }, [abierto, cargarMetodos])

  useEffect(() => {
    if (!abierto) return
    const monto = Number(montoPagoInicial) || 0
    if (monto > 0 && metodosPago.length > 0) {
      const efectivo = metodosPago.find((m) => (m.codigo || "").toLowerCase() === "efectivo")
      if (efectivo) {
        setLineasPago([{ metodo_pago_id: efectivo.id, monto, metodo_nombre: efectivo.nombre }])
        return
      }
    }
    setLineasPago([])
  }, [abierto, montoPagoInicial, metodosPago])

  const agregarLinea = () => {
    const primerMetodo = metodosPago[0]
    if (!primerMetodo) return
    setLineasPago((prev) => [
      ...prev,
      { metodo_pago_id: primerMetodo.id, monto: 0, metodo_nombre: primerMetodo.nombre },
    ])
  }

  const quitarLinea = (indice) => {
    setLineasPago((prev) => prev.filter((_, i) => i !== indice))
  }

  const cambiarLinea = (indice, campo, valor) => {
    setLineasPago((prev) =>
      prev.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l))
    )
  }

  const actualizarMetodoEnLinea = (indice, metodoPago) => {
    setLineasPago((prev) =>
      prev.map((l, i) =>
        i === indice
          ? { ...l, metodo_pago_id: metodoPago.id, metodo_nombre: metodoPago.nombre }
          : l
      )
    )
  }

  const handleConfirmar = () => {
    setError("")
    if (totalVentaNum <= 0) {
      setError("El total a pagar debe ser mayor a cero.")
      return
    }

    const pagos = lineasPago
      .map((l) => ({ metodo_pago_id: l.metodo_pago_id, monto: Number(l.monto) || 0 }))
      .filter((p) => p.monto > 0)

    const monto_pago = pagos.reduce((s, p) => s + p.monto, 0)

    if (hayFaltante && !esConsumidorFinal) {
      onConfirmar({
        crear_recibo_parcial: true,
        pagos,
        monto_pago,
      })
      return
    }

    if (hayFaltante && esConsumidorFinal) {
      const justif = (justificacionDiferencia || "").trim()
      if (!justif) {
        setError("Debe ingresar una justificación de la diferencia.")
        return
      }
      const pagosConObs = pagos.map((p, idx) => ({
        ...p,
        observacion: idx === 0 ? justif : "",
      }))
      onConfirmar({
        pagos: pagosConObs,
        monto_pago,
        justificacion_diferencia: justif,
      })
      return
    }

    if (esConsumidorFinal && !hayFaltante && !hayExcedente) {
      const diff = Math.abs(monto_pago - totalVentaNum)
      if (diff > TOLERANCIA_PESOS) {
        setError(
          'El cliente "Consumidor Final" debe abonar exactamente el total de la venta.'
        )
        return
      }
    }

    if (monto_pago < totalVentaNum - TOLERANCIA_PESOS && !hayFaltante) {
      setError("El total ingresado no alcanza al total de la venta.")
      return
    }

    if (hayExcedente && excedenteDestino === "recibo" && !esConsumidorFinal) {
      onConfirmar({
        pagos,
        monto_pago,
        excedente_destino: "recibo",
      })
      return
    }

    if (hayExcedente && esConsumidorFinal) {
      if (excedenteDestino === "vuelto_pendiente") {
        const justif = (justificacionExcedente || "").trim()
        if (!justif) {
          setError("Debe ingresar la justificación del vuelto pendiente.")
          return
        }
        onConfirmar({
          pagos,
          monto_pago,
          excedente_destino: "vuelto_pendiente",
          justificacion_excedente: justif,
        })
        return
      }
      if (excedenteDestino === "propina") {
        onConfirmar({
          pagos,
          monto_pago,
          excedente_destino: "propina",
          justificacion_excedente: (justificacionExcedente || "").trim() || undefined,
        })
        return
      }
      onConfirmar({
        pagos,
        monto_pago,
        excedente_destino: "vuelto",
      })
      return
    }

    if (hayExcedente) {
      onConfirmar({
        pagos,
        monto_pago,
        excedente_destino: excedenteDestino,
      })
      return
    }

    onConfirmar({ pagos, monto_pago })
  }


  const resetear = useCallback(() => {
    setLineasPago([])
    setExcedenteDestino("vuelto")
    setJustificacionDiferencia("")
    setJustificacionExcedente("")
    setError("")
  }, [])

  useEffect(() => {
    if (!abierto) resetear()
  }, [abierto, resetear])

  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500"
  const CLASES_INPUT =
    "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_TARJETA = "bg-white border border-slate-200 rounded-md p-4"

  return (
    <Transition show={abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
            <Dialog.Panel className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div
                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
              >
                <Dialog.Title className="text-lg font-bold text-white">
                  Registrar cobro
                </Dialog.Title>
                <button
                  type="button"
                  onClick={onClose}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                <div className={CLASES_TARJETA}>
                  <div className={CLASES_ETIQUETA}>Total a pagar</div>
                  <p className="text-xl font-semibold text-slate-800 mt-1">
                    ${totalVentaNum.toLocaleString("es-AR")}
                  </p>
                </div>

                {hayFaltante && !esConsumidorFinal && (
                  <div className={`${CLASES_TARJETA} border-blue-200 bg-blue-50`}>
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4 flex-shrink-0"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                        />
                      </svg>
                      El monto ingresado no alcanza al total. La factura se enviará automáticamente a cuenta corriente.
                    </p>
                  </div>
                )}

                {hayFaltante && esConsumidorFinal && (
                  <div className={`${CLASES_TARJETA} border-amber-200 bg-amber-50`}>
                    <label className={CLASES_ETIQUETA}>
                      Justificación de la diferencia (obligatorio)
                    </label>
                    <input
                      type="text"
                      className={`${CLASES_INPUT} mt-1`}
                      placeholder='Ej: Sin vuelto, descuento aprobado'
                      value={justificacionDiferencia}
                      onChange={(e) => {
                        setJustificacionDiferencia(e.target.value)
                        setError("")
                      }}
                    />
                  </div>
                )}

                {cargandoMetodos ? (
                  <p className="text-sm text-slate-500">Cargando métodos de pago...</p>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={CLASES_ETIQUETA}>Medios de pago</span>
                        <button
                          type="button"
                          onClick={agregarLinea}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          + Agregar
                        </button>
                      </div>
                      {lineasPago.length === 0 ? (
                        <button
                          type="button"
                          onClick={agregarLinea}
                          className="w-full border border-dashed border-slate-300 rounded-md py-3 text-sm text-slate-500 hover:border-orange-400 hover:text-orange-600"
                        >
                          Agregar medio de pago
                        </button>
                      ) : (
                        <ul className="space-y-2">
                          {lineasPago.map((linea, indice) => (
                            <li
                              key={indice}
                              className="flex items-center gap-2 flex-wrap"
                            >
                              <select
                                className={`${CLASES_INPUT} flex-1 min-w-[120px]`}
                                value={linea.metodo_pago_id}
                                onChange={(e) => {
                                  const id = Number(e.target.value)
                                  const metodo = metodosPago.find((m) => m.id === id)
                                  if (metodo) actualizarMetodoEnLinea(indice, metodo)
                                }}
                              >
                                {metodosPago.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nombre || m.codigo}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className={`${CLASES_INPUT} w-28`}
                                placeholder="Monto"
                                value={linea.monto === 0 ? "" : linea.monto}
                                onChange={(e) =>
                                  cambiarLinea(indice, "monto", e.target.value)
                                }
                              />
                              <button
                                type="button"
                                onClick={() => quitarLinea(indice)}
                                className="p-1 text-slate-400 hover:text-red-600"
                                aria-label="Quitar línea"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className={CLASES_TARJETA}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Total ingresado</span>
                        <span className="font-semibold">
                          ${totalIngresado.toLocaleString("es-AR")}
                        </span>
                      </div>
                      {Math.abs(diferencia) >= TOLERANCIA_PESOS && (
                        <div
                          className={`flex justify-between text-sm mt-2 ${hayFaltante ? "text-red-600" : "text-green-700"}`}
                        >
                          <span>
                            {hayFaltante ? "Faltante" : "Vuelto / Excedente"}
                          </span>
                          <span className="font-semibold">
                            ${Math.abs(diferencia).toLocaleString("es-AR")}
                          </span>
                        </div>
                      )}
                      {hayExcedente && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className={CLASES_ETIQUETA}>Destino del excedente</div>
                          {esConsumidorFinal ? (
                            <>
                              <p className="text-sm text-slate-600 mb-2">
                                Excedente: ${Math.abs(diferencia).toLocaleString("es-AR")}. Elija una opción:
                              </p>
                              <label className="flex items-center gap-2 mt-1">
                                <input
                                  type="radio"
                                  name="excedenteDestinoCF"
                                  checked={excedenteDestino === "vuelto"}
                                  onChange={() => setExcedenteDestino("vuelto")}
                                  className="text-orange-600"
                                />
                                <span className="text-sm">Dio vuelto al cliente</span>
                              </label>
                              <label className="flex items-center gap-2 mt-1">
                                <input
                                  type="radio"
                                  name="excedenteDestinoCF"
                                  checked={excedenteDestino === "propina"}
                                  onChange={() => setExcedenteDestino("propina")}
                                  className="text-orange-600"
                                />
                                <span className="text-sm">Cliente deja diferencia (propina/redondeo)</span>
                              </label>
                              <label className="flex items-center gap-2 mt-1">
                                <input
                                  type="radio"
                                  name="excedenteDestinoCF"
                                  checked={excedenteDestino === "vuelto_pendiente"}
                                  onChange={() => setExcedenteDestino("vuelto_pendiente")}
                                  className="text-orange-600"
                                />
                                <span className="text-sm">Vuelto pendiente</span>
                              </label>
                              {(excedenteDestino === "propina" || excedenteDestino === "vuelto_pendiente") && (
                                <div className="mt-2">
                                  <label className={CLASES_ETIQUETA}>
                                    Justificación {excedenteDestino === "vuelto_pendiente" ? "(obligatorio)" : "(opcional)"}
                                  </label>
                                  <input
                                    type="text"
                                    className={`${CLASES_INPUT} mt-1`}
                                    placeholder={
                                      excedenteDestino === "vuelto_pendiente"
                                        ? "Ej: Cliente retira mañana"
                                        : "Ej: Redondeo a favor del local"
                                    }
                                    value={justificacionExcedente}
                                    onChange={(e) => {
                                      setJustificacionExcedente(e.target.value)
                                      setError("")
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <label className="flex items-center gap-2 mt-1">
                                <input
                                  type="radio"
                                  name="excedenteDestino"
                                  checked={excedenteDestino === "vuelto"}
                                  onChange={() => setExcedenteDestino("vuelto")}
                                  className="text-orange-600"
                                />
                                <span className="text-sm">Vuelto al cliente</span>
                              </label>
                              <label className="flex items-center gap-2 mt-1">
                                <input
                                  type="radio"
                                  name="excedenteDestino"
                                  checked={excedenteDestino === "recibo"}
                                  onChange={() => setExcedenteDestino("recibo")}
                                  className="text-orange-600"
                                />
                                <span className="text-sm">A cuenta corriente (recibo)</span>
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {error}
                  </p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={
                    cargandoMetodos ||
                    (hayFaltante && esConsumidorFinal && !(justificacionDiferencia || "").trim()) ||
                    (hayExcedente &&
                      esConsumidorFinal &&
                      excedenteDestino === "vuelto_pendiente" &&
                      !(justificacionExcedente || "").trim())
                  }
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${theme.botonPrimario} disabled:opacity-50`}
                >
                  Confirmar cobro
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default ModalCobroVenta
