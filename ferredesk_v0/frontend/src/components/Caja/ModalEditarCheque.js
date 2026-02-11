"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"
import BuscadorCliente from "../BuscadorCliente"

/**
 * Modal para editar los datos de un cheque que está EN_CARTERA.
 * 
 * @param {object} cheque - Cheque a editar
 * @param {function} onGuardar - Callback al guardar exitosamente (recibe el cheque actualizado)
 * @param {function} onCancelar - Callback al cancelar
 */
const ModalEditarCheque = ({ cheque, onGuardar, onCancelar }) => {
  const theme = useFerreDeskTheme()
  const { editarCheque, validarCUIT } = useCajaAPI()
  const [formData, setFormData] = useState({
    numero: "",
    banco_emisor: "",
    monto: "",
    tipo_cheque: "AL_DIA",
    librador_nombre: "",
    cuit_librador: "",
    fecha_emision: "",
    fecha_pago: "",
    origen_tipo: "",
    origen_descripcion: "",
    origen_cliente_id: "",
  })
  const [errores, setErrores] = useState({})
  const [validandoCUIT, setValidandoCUIT] = useState(false)
  const [cuitValido, setCuitValido] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  useEffect(() => {
    if (cheque) {
      setFormData({
        numero: cheque.numero || "",
        banco_emisor: cheque.banco_emisor || "",
        monto: cheque.monto || "",
        tipo_cheque: cheque.tipo_cheque || "AL_DIA",
        librador_nombre: cheque.librador_nombre || "",
        cuit_librador: cheque.cuit_librador || "",
        fecha_emision: cheque.fecha_emision || "",
        fecha_pago: cheque.fecha_pago || "",
        origen_tipo: cheque.origen_tipo || "",
        origen_descripcion: cheque.origen_descripcion || "",
        origen_cliente_id: cheque.origen_cliente_id || "",
      })
      if (cheque.origen_cliente_id) {
        setClienteSeleccionado({
          id: cheque.origen_cliente_id,
          razon: cheque.origen_cliente_nombre
        })
      } else {
        setClienteSeleccionado(null)
      }
      setErrores({})
      setCuitValido(null)
    }
  }, [cheque])

  // Sincronizar fecha_pago si es AL_DIA
  useEffect(() => {
    if (formData.tipo_cheque === "AL_DIA" && formData.fecha_emision) {
      setFormData(prev => ({ ...prev, fecha_pago: prev.fecha_emision }))
    }
  }, [formData.tipo_cheque, formData.fecha_emision])

  const formatearCUIT = (cuit) => {
    if (!cuit) return ""
    const limpio = cuit.replace(/\D/g, "")
    if (limpio.length <= 2) return limpio
    if (limpio.length <= 10) return `${limpio.slice(0, 2)}-${limpio.slice(2)}`
    return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10, 11)}`
  }

  const limpiarCUIT = (cuit) => {
    return cuit.replace(/\D/g, "")
  }

  const handleChange = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }))
    // Limpiar error del campo al cambiar
    if (errores[campo]) {
      setErrores((prev) => {
        const nuevo = { ...prev }
        delete nuevo[campo]
        return nuevo
      })
    }
    // Si es CUIT y cambia, resetear validación
    if (campo === "cuit_librador") {
      setCuitValido(null)
    }
  }

  const handleCUITBlur = async () => {
    const cuitLimpio = limpiarCUIT(formData.cuit_librador)
    if (!cuitLimpio || cuitLimpio.length !== 11) {
      if (cuitLimpio.length > 0) {
        setErrores((prev) => ({
          ...prev,
          cuit_librador: "El CUIT debe tener 11 dígitos",
        }))
        setCuitValido(false)
      }
      return
    }

    setValidandoCUIT(true)
    try {
      const resultado = await validarCUIT(cuitLimpio)
      if (resultado.es_valido) {
        setCuitValido(true)
        // Formatear CUIT si es válido
        const cuitFormateado = formatearCUIT(cuitLimpio)
        setFormData((prev) => ({ ...prev, cuit_librador: cuitFormateado }))
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

    if (!formData.numero?.trim()) {
      nuevosErrores.numero = "El número es obligatorio"
    }

    if (!formData.banco_emisor?.trim()) {
      nuevosErrores.banco_emisor = "El banco emisor es obligatorio"
    }

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

    if (!formData.fecha_emision) {
      nuevosErrores.fecha_emision = "La fecha de emisión es obligatoria"
    }

    if (!formData.fecha_pago) {
      nuevosErrores.fecha_pago = "La fecha de pago es obligatoria"
    }

    if (formData.fecha_emision && formData.fecha_pago) {
      const fechaEmision = new Date(formData.fecha_emision)
      const fechaPago = new Date(formData.fecha_pago)
      if (fechaEmision > fechaPago) {
        nuevosErrores.fecha_pago = "La fecha de pago no puede ser anterior a la de emisión"
      }

      const diffTime = Math.abs(fechaPago - fechaEmision)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 360) {
        nuevosErrores.fecha_pago = "La fecha de pago no puede exceder los 360 días"
      }
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleGuardar = async (e) => {
    e?.preventDefault()
    if (!validarFormulario()) {
      return
    }

    setGuardando(true)
    try {
      const datosEnviar = {
        numero: formData.numero.trim(),
        banco_emisor: formData.banco_emisor.trim(),
        monto: parseFloat(formData.monto),
        tipo_cheque: formData.tipo_cheque,
        librador_nombre: formData.librador_nombre.trim(),
        cuit_librador: limpiarCUIT(formData.cuit_librador),
        fecha_emision: formData.fecha_emision,
        fecha_pago: formData.fecha_pago,
        origen_cliente_id: formData.origen_cliente_id || null,
        origen_descripcion: formData.origen_descripcion?.trim() || "",
      }

      const chequeActualizado = await editarCheque(cheque.id, datosEnviar)
      onGuardar(chequeActualizado)
    } catch (err) {
      console.error("Error al editar cheque:", err)
      alert(err.message || "Error al guardar los cambios")
    } finally {
      setGuardando(false)
    }
  }

  const puedeGuardar = () => {
    return (
      !guardando &&
      formData.numero?.trim() &&
      formData.banco_emisor?.trim() &&
      formData.monto &&
      limpiarCUIT(formData.cuit_librador).length === 11 &&
      formData.fecha_emision &&
      formData.fecha_pago &&
      formData.librador_nombre?.trim() &&
      Object.keys(errores).length === 0 &&
      cuitValido !== false
    )
  }

  const CLASES_ETIQUETA = "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
  const CLASES_INPUT =
    "w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
  const CLASES_INPUT_ERROR = CLASES_INPUT + " border-red-300 focus:border-red-500 focus:ring-red-500"

  return (
    <Transition show={!!cheque} as={Fragment} appear>
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
              {/* Header */}
              <div
                className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}
              >
                <Dialog.Title className="text-lg font-bold text-white">
                  Editar Cheque
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

              {/* Formulario */}
              <form onSubmit={handleGuardar} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                {/* Número */}
                <div>
                  <label htmlFor="numero" className={CLASES_ETIQUETA}>
                    Número *
                  </label>
                  <input
                    id="numero"
                    type="text"
                    value={formData.numero}
                    onChange={(e) => handleChange("numero", e.target.value)}
                    className={errores.numero ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.numero && (
                    <p className="text-xs text-red-600 mt-1">{errores.numero}</p>
                  )}
                </div>

                {/* Banco Emisor */}
                <div>
                  <label htmlFor="banco_emisor" className={CLASES_ETIQUETA}>
                    Banco Emisor *
                  </label>
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

                {/* Monto */}
                <div>
                  <label htmlFor="monto" className={CLASES_ETIQUETA}>
                    Monto *
                  </label>
                  <input
                    id="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.monto}
                    onChange={(e) => handleChange("monto", e.target.value)}
                    className={errores.monto ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.monto && (
                    <p className="text-xs text-red-600 mt-1">{errores.monto}</p>
                  )}
                </div>

                {/* Librador */}
                <div>
                  <label htmlFor="librador_nombre" className={CLASES_ETIQUETA}>
                    Razón Social / Librador *
                  </label>
                  <input
                    id="librador_nombre"
                    type="text"
                    value={formData.librador_nombre}
                    onChange={(e) => handleChange("librador_nombre", e.target.value)}
                    className={errores.librador_nombre ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.librador_nombre && (
                    <p className="text-xs text-red-600 mt-1">{errores.librador_nombre}</p>
                  )}
                </div>

                {/* CUIT Librador */}
                <div>
                  <label htmlFor="cuit_librador" className={CLASES_ETIQUETA}>
                    CUIT Librador *
                  </label>
                  <div className="relative">
                    <input
                      id="cuit_librador"
                      type="text"
                      placeholder="XX-XXXXXXXX-X"
                      value={formatearCUIT(formData.cuit_librador)}
                      onChange={(e) => handleChange("cuit_librador", e.target.value)}
                      onBlur={handleCUITBlur}
                      className={errores.cuit_librador ? CLASES_INPUT_ERROR : CLASES_INPUT}
                    />
                    {validandoCUIT && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        Validando...
                      </div>
                    )}
                    {cuitValido === true && !validandoCUIT && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">
                        ✓
                      </div>
                    )}
                  </div>
                  {errores.cuit_librador && (
                    <p className="text-xs text-red-600 mt-1">{errores.cuit_librador}</p>
                  )}
                </div>

                {/* Tipo de Cheque */}
                <div>
                  <label htmlFor="tipo_cheque" className={CLASES_ETIQUETA}>Tipo *</label>
                  <div className="flex bg-slate-100 rounded p-1 gap-1 h-9">
                    <button
                      type="button"
                      onClick={() => handleChange("tipo_cheque", "AL_DIA")}
                      className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${formData.tipo_cheque === "AL_DIA"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      Al día
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange("tipo_cheque", "DIFERIDO")}
                      className={`flex-1 text-[10px] font-bold rounded transition-all uppercase ${formData.tipo_cheque === "DIFERIDO"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      Diferido
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Fecha Emisión */}
                  <div>
                    <label htmlFor="fecha_emision" className={CLASES_ETIQUETA}>
                      Fecha Emisión *
                    </label>
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

                  {/* Fecha de Pago */}
                  <div>
                    <label htmlFor="fecha_pago" className={CLASES_ETIQUETA}>
                      Fecha de Pago *
                    </label>
                    <input
                      id="fecha_pago"
                      type="date"
                      value={formData.fecha_pago}
                      onChange={(e) => handleChange("fecha_pago", e.target.value)}
                      readOnly={formData.tipo_cheque === "AL_DIA"}
                      className={`${errores.fecha_pago ? CLASES_INPUT_ERROR : CLASES_INPUT} ${formData.tipo_cheque === "AL_DIA" ? "bg-slate-50 cursor-not-allowed text-slate-500" : ""
                        }`}
                    />
                    {errores.fecha_pago && (
                      <p className="text-xs text-red-600 mt-1">{errores.fecha_pago}</p>
                    )}
                  </div>
                </div>

                {/* Origen */}
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Información de Origen</h4>

                  <div className="mb-4">
                    <label htmlFor="origen_descripcion" className={CLASES_ETIQUETA}>
                      Descripción del Origen
                    </label>
                    <input
                      id="origen_descripcion"
                      type="text"
                      value={formData.origen_descripcion}
                      onChange={(e) => handleChange("origen_descripcion", e.target.value)}
                      placeholder="Ej: Cobro factura duplicada"
                      className={CLASES_INPUT}
                    />
                  </div>

                  <div>
                    <label className={CLASES_ETIQUETA}>
                      Cliente de Origen
                    </label>
                    {clienteSeleccionado ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-1.5 flex-1 min-w-0">
                          {clienteSeleccionado.razon || "Cliente #" + clienteSeleccionado.id}
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
                        placeholder="Buscar cliente..."
                      />
                    )}
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={!puedeGuardar()}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${theme.botonPrimario} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default ModalEditarCheque
