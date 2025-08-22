"use client"

import React, { Fragment, useEffect, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

export const MaestroModal = ({
  open,
  tipo, // "barrio" | "localidad" | "provincia" | "transporte" | "plazo" | "categoria"
  modo = "nuevo",
  initialValues = {},
  localidades = [],
  loading = false,
  error = "",
  onSubmit = () => {},
  onCancel = () => {},
}) => {
  const theme = useFerreDeskTheme()
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm(initialValues || {})
  }, [initialValues, tipo])

  if (!open) return null

  const renderContenido = () => {
    switch (tipo) {
      case "barrio":
      case "localidad":
      case "provincia":
      case "categoria":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.nombre || ""}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.activo || "S"}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "transporte":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.nombre || ""}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            <label className="block mb-2 text-slate-700 font-medium">Localidad *</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.localidad || ""}
              onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
              required
            >
              <option value="">Seleccionar...</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.activo || "S"}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      case "plazo":
        return (
          <>
            <label className="block mb-2 text-slate-700 font-medium">Nombre *</label>
            <input
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.nombre || ""}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
            />
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-600">Plazo {i + 1}</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded-xl px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={form[`pla_pla${i + 1}`] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, [`pla_pla${i + 1}`]: e.target.value }))}
                    min="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-600">Porcentaje {i + 1}</label>
                  <input
                    type="number"
                    className="w-full border border-slate-300 rounded-xl px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={form[`pla_por${i + 1}`] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, [`pla_por${i + 1}`]: e.target.value }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            ))}
            <label className="block mb-2 text-slate-700 font-medium">Activo</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2 mb-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={form.activo || "S"}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.value }))}
            >
              <option value="S">Sí</option>
              <option value="N">No</option>
            </select>
          </>
        )
      default:
        return null
    }
  }

  const titulo = `${modo === "editar" ? "Editar" : "Nuevo"} ${tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : ""}`

  return (
    <Transition show={open} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        {/* Panel */}
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
            <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 max-h-[90vh]">
              {/* Header */}
              <div className={`px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-bold text-white">{titulo}</Dialog.Title>
                  <button onClick={onCancel} className="p-2 rounded-lg text-slate-200 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto" style={{ maxHeight: "70vh" }}>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">{error}</div>
                )}
                {renderContenido()}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
                <button onClick={onCancel} className="px-4 py-2 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium">Cancelar</button>
                <button onClick={() => onSubmit(form)} disabled={loading} className={theme.botonPrimario}>
                  {loading ? "Guardando..." : (modo === "editar" ? "Guardar cambios" : "Guardar")}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}

export default MaestroModal


