"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import BuscadorCliente from "../BuscadorCliente"

const ORIGEN_CAJA_GENERAL = "CAJA_GENERAL"
const ORIGEN_CAMBIO_CHEQUE = "CAMBIO_CHEQUE"
const TIPO_CHEQUE_AL_DIA = "AL_DIA"
const TIPO_CHEQUE_DIFERIDO = "DIFERIDO"

/**
 * Modal para registrar un cheque desde caja (caja general o cambio de cheque).
 * No requiere venta asociada.
 *
 * @param {boolean} abierto - Si el modal está visible
 * @param {function} onConfirmar - Callback al guardar (recibe el cheque creado)
 * @param {function} onCancelar - Callback al cancelar
 * @param {boolean} loading - Si está enviando el formulario
 */
const ModalRegistrarChequeCaja = ({ abierto, onConfirmar, onCancelar, loading }) => {
  const theme = useFerreDeskTheme()
  const { validarCUIT } = useCajaAPI()

  const hoy = () => new Date().toISOString().slice(0, 10)

  const [formData, setFormData] = useState({
    numero: "",
    banco_emisor: "",
    monto: "",
    tipo_cheque: TIPO_CHEQUE_AL_DIA,
    librador_nombre: "",
    cuit_librador: "",
    fecha_emision: hoy(),
    fecha_pago: hoy(),
    origen_tipo: ORIGEN_CAJA_GENERAL,
    origen_descripcion: "",
    origen_cliente_id: "",
    monto_efectivo_entregado: "",
    comision_cambio: "",
  })
  const [errores, setErrores] = useState({})
  const [validandoCUIT, setValidandoCUIT] = useState(false)
  const [cuitValido, setCuitValido] = useState(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  useEffect(() => {
    if (abierto) {
      setFormData({
        numero: "",
        banco_emisor: "",
        monto: "",
        tipo_cheque: TIPO_CHEQUE_AL_DIA,
        librador_nombre: "",
        cuit_librador: "",
        fecha_emision: hoy(),
        fecha_pago: hoy(),
        origen_tipo: ORIGEN_CAJA_GENERAL,
        origen_descripcion: "",
        origen_cliente_id: "",
        monto_efectivo_entregado: "",
        comision_cambio: "",
      })
      setErrores({})
      setCuitValido(null)
      setClienteSeleccionado(null)
    }
  }, [abierto])

  // Lógica para sincronizar fecha_pago si es AL_DIA
  useEffect(() => {
    if (formData.tipo_cheque === TIPO_CHEQUE_AL_DIA) {
      setFormData(prev => ({ ...prev, fecha_pago: prev.fecha_emision }))
    }
  }, [formData.fecha_emision, formData.tipo_cheque])

  const formatearCUIT = (cuit) => {
    if (!cuit) return ""
    const limpio = cuit.replace(/\D/g, "")
    if (limpio.length <= 2) return limpio
    if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
    return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10, 11)}`
  }

  const limpiarCUIT = (cuit) => (cuit || "").replace(/\D/g, "")

  const handleChange = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }))
    if (errores[campo]) {
      setErrores((prev) => {
        const nuevo = { ...prev }
        delete nuevo[campo]
        return nuevo
      })
    }
    if (campo === "cuit_librador") setCuitValido(null)
  }

  const handleCUITBlur = async () => {
    const cuitLimpio = limpiarCUIT(formData.cuit_librador)
    if (!cuitLimpio || cuitLimpio.length !== 11) {
      if (cuitLimpio.length > 0) {
        setErrores((prev) => ({ ...prev, cuit_librador: "El CUIT debe tener 11 dígitos" }))
        setCuitValido(false)
      }
      return
    }
    setValidandoCUIT(true)
    try {
      const resultado = await validarCUIT(cuitLimpio)
      if (resultado.es_valido) {
        setCuitValido(true)
        setFormData((prev) => ({ ...prev, cuit_librador: formatearCUIT(cuitLimpio) }))
        setErrores((prev) => {
          const nuevo = { ...prev }
          delete nuevo.cuit_librador
          return nuevo
        })
      } else {
        setCuitValido(false)
        setErrores((prev) => ({
          ...prev,
          cuit_librador: resultado.mensaje_error || "CUIT inválido",
        }))
      }
    } catch (err) {
      setCuitValido(false)
      setErrores((prev) => ({
        ...prev,
        cuit_librador: err.message || "Error al validar CUIT",
      }))
    } finally {
      setValidandoCUIT(false)
    }
  }

  const validarFormulario = () => {
    const nuevosErrores = {}

    if (!formData.numero?.trim()) nuevosErrores.numero = "El número es obligatorio"
    if (!formData.banco_emisor?.trim()) nuevosErrores.banco_emisor = "El banco emisor es obligatorio"

    const monto = parseFloat(formData.monto)
    if (!formData.monto || isNaN(monto) || monto <= 0) {
      nuevosErrores.monto = "El monto debe ser mayor a 0"
    }

    const cuitLimpio = limpiarCUIT(formData.cuit_librador)
    if (!cuitLimpio || cuitLimpio.length !== 11) {
      nuevosErrores.cuit_librador = "El CUIT debe tener 11 dígitos"
    } else if (cuitValido === false) {
      nuevosErrores.cuit_librador = "El CUIT no es válido"
    }

    if (!formData.fecha_emision) nuevosErrores.fecha_emision = "La fecha de emisión es obligatoria"
    if (!formData.fecha_pago) {
      nuevosErrores.fecha_pago = "La fecha de pago es obligatoria"
    }
    if (formData.fecha_emision && formData.fecha_pago) {
      const fe = new Date(formData.fecha_emision)
      const fp = new Date(formData.fecha_pago)
      if (fe > fp) {
        nuevosErrores.fecha_pago = "La fecha de pago no puede ser anterior a la de emisión"
      }

      // Validar max 360 días
      const diffTime = Math.abs(fp - fe)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 360) {
        nuevosErrores.fecha_pago = "La fecha de pago no puede exceder los 360 días"
      }
    }

    if (formData.origen_tipo === ORIGEN_CAMBIO_CHEQUE) {
      const efectivo = parseFloat(formData.monto_efectivo_entregado)
      const comision = parseFloat(formData.comision_cambio) || 0
      if (formData.monto_efectivo_entregado === "" || isNaN(efectivo)) {
        nuevosErrores.monto_efectivo_entregado = "Indique el monto de efectivo entregado"
      } else if (efectivo > monto) {
        nuevosErrores.monto_efectivo_entregado = "El efectivo no puede ser mayor al monto del cheque"
      } else if (Math.abs(monto - efectivo - comision) > 0.01) {
        nuevosErrores.monto_efectivo_entregado =
          "Monto del cheque debe ser igual a efectivo + comisión"
      }
      if (comision < 0) {
        nuevosErrores.comision_cambio = "La comisión no puede ser negativa"
      }
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validarFormulario()) return

    if (!window.confirm("¿Está seguro de que desea registrar este cheque?")) {
      return
    }

    const payload = {
      numero: formData.numero.trim(),
      banco_emisor: formData.banco_emisor.trim(),
      monto: parseFloat(formData.monto),
      tipo_cheque: formData.tipo_cheque,
      librador_nombre: formData.librador_nombre.trim(),
      cuit_librador: limpiarCUIT(formData.cuit_librador),
      fecha_emision: formData.fecha_emision,
      fecha_pago: formData.fecha_pago,
      origen_tipo: formData.origen_tipo,
      origen_descripcion: formData.origen_descripcion?.trim() || undefined,
    }
    if (formData.origen_cliente_id?.toString().trim()) {
      const id = parseInt(formData.origen_cliente_id, 10)
      if (!isNaN(id)) payload.origen_cliente_id = id
    }
    if (formData.origen_tipo === ORIGEN_CAMBIO_CHEQUE) {
      payload.monto_efectivo_entregado = parseFloat(formData.monto_efectivo_entregado)
      const com = parseFloat(formData.comision_cambio)
      payload.comision_cambio = isNaN(com) || com < 0 ? 0 : com
    }

    onConfirmar(payload)
  }

  const esCambioCheque = formData.origen_tipo === ORIGEN_CAMBIO_CHEQUE
  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
  const CLASES_INPUT =
    "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_INPUT_ERROR = CLASES_INPUT + " border-red-300 focus:border-red-500 focus:ring-red-500"

  return (
    <Transition show={abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onCancelar}>
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
            <Dialog.Panel className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div
                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
              >
                <Dialog.Title className="text-lg font-bold text-white">
                  Registrar cheque desde caja
                </Dialog.Title>
                <button
                  type="button"
                  onClick={onCancelar}
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

              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label htmlFor="numero" className={CLASES_ETIQUETA}>Número *</label>
                  <input
                    id="numero"
                    type="text"
                    value={formData.numero}
                    onChange={(e) => handleChange("numero", e.target.value)}
                    className={errores.numero ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.numero && <p className="text-xs text-red-600 mt-1">{errores.numero}</p>}
                </div>

                <div>
                  <label htmlFor="banco_emisor" className={CLASES_ETIQUETA}>Banco emisor *</label>
                  <input
                    id="banco_emisor"
                    type="text"
                    value={formData.banco_emisor}
                    onChange={(e) => handleChange("banco_emisor", e.target.value)}
                    className={errores.banco_emisor ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.banco_emisor && (
                    <p className="text-xs text-red-600 mt-1">{errores.banco_emisor}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="monto" className={CLASES_ETIQUETA}>Monto *</label>
                  <input
                    id="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.monto}
                    onChange={(e) => handleChange("monto", e.target.value)}
                    className={errores.monto ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.monto && <p className="text-xs text-red-600 mt-1">{errores.monto}</p>}
                </div>

                <div>
                  <label htmlFor="librador_nombre" className={CLASES_ETIQUETA}>Razón Social / Librador *</label>
                  <input
                    id="librador_nombre"
                    type="text"
                    value={formData.librador_nombre}
                    onChange={(e) => handleChange("librador_nombre", e.target.value)}
                    placeholder="Ej: Juan Pérez o Empresa S.A."
                    className={errores.librador_nombre ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.librador_nombre && <p className="text-xs text-red-600 mt-1">{errores.librador_nombre}</p>}
                </div>

                <div>
                  <label htmlFor="cuit_librador" className={CLASES_ETIQUETA}>
                    CUIT librador * {validandoCUIT && "(validando…)"}
                    {cuitValido === true && " ✓"}
                  </label>
                  <input
                    id="cuit_librador"
                    type="text"
                    value={formData.cuit_librador}
                    onChange={(e) => handleChange("cuit_librador", e.target.value)}
                    onBlur={handleCUITBlur}
                    placeholder="20-12345678-9"
                    className={errores.cuit_librador ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.cuit_librador && (
                    <p className="text-xs text-red-600 mt-1">{errores.cuit_librador}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tipo_cheque" className={CLASES_ETIQUETA}>Tipo *</label>
                  <div className="flex bg-slate-100 rounded p-1 gap-1 h-9">
                    <button
                      type="button"
                      onClick={() => handleChange("tipo_cheque", TIPO_CHEQUE_AL_DIA)}
                      className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${formData.tipo_cheque === TIPO_CHEQUE_AL_DIA
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      Al día
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange("tipo_cheque", TIPO_CHEQUE_DIFERIDO)}
                      className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${formData.tipo_cheque === TIPO_CHEQUE_DIFERIDO
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      Diferido
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fecha_emision" className={CLASES_ETIQUETA}>Fecha emisión *</label>
                    <input
                      id="fecha_emision"
                      type="date"
                      value={formData.fecha_emision}
                      onChange={(e) => handleChange("fecha_emision", e.target.value)}
                      className={errores.fecha_emision ? CLASES_INPUT_ERROR : CLASES_INPUT}
                    />
                    {errores.fecha_emision && (
                      <p className="text-xs text-red-600 mt-1">{errores.fecha_emision}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="fecha_pago" className={CLASES_ETIQUETA}>
                      Fecha de Pago *
                    </label>
                    <input
                      id="fecha_pago"
                      type="date"
                      value={formData.fecha_pago}
                      onChange={(e) => handleChange("fecha_pago", e.target.value)}
                      readOnly={formData.tipo_cheque === TIPO_CHEQUE_AL_DIA}
                      className={`${errores.fecha_pago ? CLASES_INPUT_ERROR : CLASES_INPUT} ${formData.tipo_cheque === TIPO_CHEQUE_AL_DIA ? "bg-slate-50 cursor-not-allowed text-slate-500 font-medium" : ""
                        }`}
                    />
                    {errores.fecha_pago && (
                      <p className="text-xs text-red-600 mt-1">{errores.fecha_pago}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="origen_tipo" className={CLASES_ETIQUETA}>Origen *</label>
                  <select
                    id="origen_tipo"
                    value={formData.origen_tipo}
                    onChange={(e) => handleChange("origen_tipo", e.target.value)}
                    className={CLASES_INPUT}
                  >
                    <option value={ORIGEN_CAJA_GENERAL}>Caja general</option>
                    <option value={ORIGEN_CAMBIO_CHEQUE}>Cambio de cheque</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="origen_descripcion" className={CLASES_ETIQUETA}>
                    Descripción (opcional)
                  </label>
                  <input
                    id="origen_descripcion"
                    type="text"
                    value={formData.origen_descripcion}
                    onChange={(e) => handleChange("origen_descripcion", e.target.value)}
                    placeholder="Ej: Cambio - Juan Pérez"
                    className={CLASES_INPUT}
                  />
                </div>

                <div>
                  <label className={CLASES_ETIQUETA}>
                    Cliente (opcional)
                  </label>
                  {clienteSeleccionado ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-1.5 flex-1 min-w-0">
                        {clienteSeleccionado.razon || clienteSeleccionado.fantasia || "Sin nombre"}
                        {clienteSeleccionado.cuit && (
                          <span className="text-slate-500 ml-1">— {clienteSeleccionado.cuit}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setClienteSeleccionado(null)
                          setFormData((prev) => ({ ...prev, origen_cliente_id: "" }))
                        }}
                        className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <BuscadorCliente
                      onSelect={(c) => {
                        setClienteSeleccionado(c)
                        setFormData((prev) => ({ ...prev, origen_cliente_id: c.id }))
                      }}
                      placeholder="Buscar cliente (mín. 2 caracteres)..."
                    />
                  )}
                </div>

                {esCambioCheque && (
                  <>
                    <div>
                      <label htmlFor="monto_efectivo_entregado" className={CLASES_ETIQUETA}>
                        Monto efectivo entregado *
                      </label>
                      <input
                        id="monto_efectivo_entregado"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto_efectivo_entregado}
                        onChange={(e) => handleChange("monto_efectivo_entregado", e.target.value)}
                        className={
                          errores.monto_efectivo_entregado ? CLASES_INPUT_ERROR : CLASES_INPUT
                        }
                      />
                      {errores.monto_efectivo_entregado && (
                        <p className="text-xs text-red-600 mt-1">
                          {errores.monto_efectivo_entregado}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="comision_cambio" className={CLASES_ETIQUETA}>
                        Comisión (opcional)
                      </label>
                      <input
                        id="comision_cambio"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.comision_cambio}
                        onChange={(e) => handleChange("comision_cambio", e.target.value)}
                        className={errores.comision_cambio ? CLASES_INPUT_ERROR : CLASES_INPUT}
                      />
                      {errores.comision_cambio && (
                        <p className="text-xs text-red-600 mt-1">{errores.comision_cambio}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={onCancelar}
                    className="text-sm px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || validandoCUIT}
                    className="text-sm px-3 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {loading ? "Guardando…" : "Registrar cheque"}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default ModalRegistrarChequeCaja
