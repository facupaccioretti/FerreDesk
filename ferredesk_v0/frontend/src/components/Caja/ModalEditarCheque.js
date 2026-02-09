"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { useCajaAPI } from "../../utils/useCajaAPI"

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
    cuit_librador: "",
    fecha_emision: "",
    fecha_presentacion: "",
  })
  const [errores, setErrores] = useState({})
  const [validandoCUIT, setValidandoCUIT] = useState(false)
  const [cuitValido, setCuitValido] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (cheque) {
      setFormData({
        numero: cheque.numero || "",
        banco_emisor: cheque.banco_emisor || "",
        monto: cheque.monto || "",
        cuit_librador: cheque.cuit_librador || "",
        fecha_emision: cheque.fecha_emision || "",
        fecha_presentacion: cheque.fecha_presentacion || "",
      })
      setErrores({})
      setCuitValido(null)
    }
  }, [cheque])

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

    if (!formData.fecha_presentacion) {
      nuevosErrores.fecha_presentacion = "La fecha de presentación es obligatoria"
    }

    if (formData.fecha_emision && formData.fecha_presentacion) {
      const fechaEmision = new Date(formData.fecha_emision)
      const fechaPresentacion = new Date(formData.fecha_presentacion)
      if (fechaEmision > fechaPresentacion) {
        nuevosErrores.fecha_emision = "La fecha de emisión debe ser menor o igual a la fecha de presentación"
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
        cuit_librador: limpiarCUIT(formData.cuit_librador),
        fecha_emision: formData.fecha_emision,
        fecha_presentacion: formData.fecha_presentacion,
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
      formData.fecha_presentacion &&
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
            <Dialog.Panel className="w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
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

                {/* Fecha Presentación */}
                <div>
                  <label htmlFor="fecha_presentacion" className={CLASES_ETIQUETA}>
                    Fecha Presentación *
                  </label>
                  <input
                    id="fecha_presentacion"
                    type="date"
                    value={formData.fecha_presentacion}
                    onChange={(e) => handleChange("fecha_presentacion", e.target.value)}
                    className={errores.fecha_presentacion ? CLASES_INPUT_ERROR : CLASES_INPUT}
                  />
                  {errores.fecha_presentacion && (
                    <p className="text-xs text-red-600 mt-1">{errores.fecha_presentacion}</p>
                  )}
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
