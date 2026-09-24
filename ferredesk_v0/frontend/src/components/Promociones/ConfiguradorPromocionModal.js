"use client"

// ConfiguradorPromocionModal.js — Distribuir la cantidad de cada grupo de
// una promocion entre sus alternativas (y, al agregarla, la cantidad de linea).
//
// POR QUE UN SOLO COMPONENTE PARA AGREGAR Y RECONFIGURAR: la regla de negocio
// es la misma en los dos casos (cada grupo debe completar su cantidad); separarlos hubiera significado
// duplicar esa regla. `modo` solo cambia si se pide la cantidad inicial.

import { Fragment, useEffect, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"

export default function ConfiguradorPromocionModal({
  abierto = false,
  modo = "agregar", // 'agregar' | 'reconfigurar'
  promocion,
  eleccionesIniciales = [],
  cantidadInicial = 1,
  onConfirmar = () => {},
  onCancelar = () => {},
}) {
  const [elecciones, setElecciones] = useState({}) // { [grupo_id]: { [stock_id]: cantidad } }
  const [cantidad, setCantidad] = useState(cantidadInicial)

  useEffect(() => {
    if (!abierto) return
    const mapaInicial = {}
    for (const eleccion of eleccionesIniciales) {
      const grupo = (promocion?.grupos || []).find((item) => item.id === eleccion.grupo_id)
      const cantidadElegida = eleccion.cantidad ?? grupo?.cantidad ?? 0
      mapaInicial[eleccion.grupo_id] = {
        ...(mapaInicial[eleccion.grupo_id] || {}),
        [eleccion.stock_id]: String(cantidadElegida),
      }
    }
    setElecciones(mapaInicial)
    setCantidad(cantidadInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, promocion?.id])

  if (!promocion) return null

  const grupos = promocion.grupos || []
  const items = promocion.items || []
  const cantidadElegida = (grupo) => Object.values(elecciones[grupo.id] || {}).reduce(
    (total, cantidadElegidaGrupo) => total + (Number(cantidadElegidaGrupo) || 0),
    0,
  )
  const faltanGrupos = grupos.some((grupo) => Math.abs(cantidadElegida(grupo) - Number(grupo.cantidad)) > 0.000001)

  const cambiarCantidadAlternativa = (grupoId, stockId, valor) => {
    setElecciones((prev) => ({
      ...prev,
      [grupoId]: {
        ...(prev[grupoId] || {}),
        [stockId]: valor,
      },
    }))
  }

  const handleConfirmar = () => {
    if (faltanGrupos) return
    const eleccionesGrupos = grupos.flatMap((grupo) => Object.entries(elecciones[grupo.id] || {})
      .filter(([, cantidadElegidaGrupo]) => Number(cantidadElegidaGrupo) > 0)
      .map(([stockId, cantidadElegidaGrupo]) => ({
        grupo_id: grupo.id,
        stock_id: Number(stockId),
        cantidad: Number(cantidadElegidaGrupo),
      })))
    onConfirmar(eleccionesGrupos, Number(cantidad) || 1)
  }

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
            <Dialog.Panel className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700">
                <div>
                  <Dialog.Title className="text-lg font-bold text-white">{promocion.nombre}</Dialog.Title>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {modo === "reconfigurar" ? "Cambiar la elección de esta promoción" : "Elegí las opciones de esta promoción"}
                  </p>
                </div>
                <button onClick={onCancelar} className="text-slate-200 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
                {items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Incluye siempre
                    </h4>
                    <div className="space-y-1">
                      {items.map((it) => (
                        <div key={it.stock_id} className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          {it.denominacion} <span className="text-slate-400">x{it.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {grupos.map((grupo) => (
                  <div key={grupo.id}>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {grupo.nombre} <span className="normal-case font-normal">(completa {grupo.cantidad})</span>
                    </h4>
                    <div className="space-y-1">
                      {(grupo.alternativas || []).map((alt) => {
                        const cantidadAlternativa = elecciones[grupo.id]?.[alt.stock_id] ?? ""
                        return (
                          <div
                            key={alt.stock_id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                              Number(cantidadAlternativa) > 0 ? "border-orange-500 bg-orange-50" : "border-slate-200"
                            }`}
                          >
                            <span className="flex-1 text-sm text-slate-700">{alt.denominacion}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max={grupo.cantidad}
                              value={cantidadAlternativa}
                              onChange={(event) => cambiarCantidadAlternativa(grupo.id, alt.stock_id, event.target.value)}
                              aria-label={`Cantidad de ${alt.denominacion}`}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </div>
                        )
                      })}
                    </div>
                    <p className={`mt-2 text-xs ${Math.abs(cantidadElegida(grupo) - Number(grupo.cantidad)) <= 0.000001 ? "text-emerald-600" : "text-amber-600"}`}>
                      Elegidos: {cantidadElegida(grupo)} de {grupo.cantidad}
                    </p>
                  </div>
                ))}

                {modo === "agregar" && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cantidad</h4>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                )}

                {faltanGrupos && (
                  <p className="text-xs text-amber-600">Completá exactamente la cantidad indicada en cada grupo para confirmar.</p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={faltanGrupos}
                  onClick={handleConfirmar}
                  className="px-6 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800"
                >
                  Confirmar
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}
