"use client"

// SelectorPromocionModal.js — Lista buscable de promociones activas y
// vigentes para agregarlas a una venta/presupuesto. Sigue el mismo patron
// visual que ClienteSelectorModal.js (Dialog/Transition de @headlessui/react,
// ya en uso en el proyecto; no se agrega ninguna libreria nueva).
//
// POR QUE: No usa Tabla.js aca porque el contenido por promocion (nombre +
// resumen de componentes + precio) es mas una tarjeta que una fila tabular;
// el resto del selector (buscador, cierre, estados vacios) sigue el mismo
// lenguaje visual que los demas selectores del proyecto.

import { Fragment, useMemo, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { usePromocionesVigentesAPI } from "./hooks/usePromocionesAPI"

function resumenComponentes(promocion) {
  const partesFijas = (promocion.items || []).map((it) => `${it.denominacion} x${it.cantidad}`)
  const partesGrupos = (promocion.grupos || []).map((g) => `${g.nombre} a elección`)
  const partes = [...partesFijas, ...partesGrupos]
  return partes.length > 0 ? partes.join(" · ") : "Sin componentes"
}

export default function SelectorPromocionModal({
  abierto = false,
  onCerrar = () => {},
  onSeleccionar = () => {},
}) {
  const [termino, setTermino] = useState("")
  const { datos: promociones, cargando } = usePromocionesVigentesAPI({ itemsPorPagina: 100, search: termino })

  useEffect(() => {
    if (abierto) setTermino("")
  }, [abierto])

  const promocionesFiltradas = useMemo(() => {
    const buscado = termino.trim().toLowerCase()
    if (!buscado) return promociones
    return promociones.filter((p) => (p.nombre || "").toLowerCase().includes(buscado))
  }, [promociones, termino])

  return (
    <Transition show={abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-40" onClose={onCerrar}>
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
            <Dialog.Panel className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700">
                <Dialog.Title className="text-lg font-bold text-white">Seleccionar promoción</Dialog.Title>
                <button onClick={onCerrar} className="text-slate-200 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4">
                <input
                  type="text"
                  autoFocus
                  value={termino}
                  onChange={(e) => setTermino(e.target.value)}
                  placeholder="Buscar promoción por nombre..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="px-6 pb-6 max-h-[55vh] overflow-y-auto space-y-2">
                {cargando ? (
                  <div className="text-center py-10 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-orange-600 mx-auto mb-2" />
                    Cargando promociones...
                  </div>
                ) : promocionesFiltradas.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    {termino ? "Sin promociones que coincidan con la búsqueda." : "No hay promociones activas."}
                  </div>
                ) : (
                  promocionesFiltradas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSeleccionar(p)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{resumenComponentes(p)}</p>
                          {(p.grupos || []).length > 0 && (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                              Requiere elegir opciones
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-bold text-emerald-600">
                          ${Number(p.precio_promocional || 0).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}
