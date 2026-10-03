import { Dialog, Transition } from "@headlessui/react"
import { Fragment, useEffect, useState } from "react"
import guiaPromocionesUrl from "../assets/manuales/guia-promociones.pdf"

export const NOVEDAD_ACTUAL = {
  id: "promociones-2026-10",
  titulo: "Nuevo modulo de promociones",
  descripcion: "Ya podes crear promociones y aplicarlas en tus ventas. Consulta la guia para conocer el flujo completo.",
  pdfUrl: guiaPromocionesUrl,
}

export function claveNovedad(username) {
  return `ferredesk:novedad-vista:${username}`
}

export function novedadFueVista(username) {
  if (!username) return true
  try {
    return window.localStorage.getItem(claveNovedad(username)) === NOVEDAD_ACTUAL.id
  } catch (_) {
    return false
  }
}

export function marcarNovedadVista(username) {
  if (!username) return
  try {
    window.localStorage.setItem(claveNovedad(username), NOVEDAD_ACTUAL.id)
  } catch (_) {}
}

export default function NovedadesNavbar({ user }) {
  const username = user?.username
  const [abierto, setAbierto] = useState(false)
  const [pendiente, setPendiente] = useState(false)

  useEffect(() => {
    if (!username) return
    const noVista = !novedadFueVista(username)
    setPendiente(noVista)
    setAbierto(noVista)
  }, [username])

  const cerrar = () => {
    marcarNovedadVista(username)
    setPendiente(false)
    setAbierto(false)
  }

  return (
    <>
      <div className="relative group">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="relative flex items-center justify-center rounded-lg border border-slate-500/40 bg-slate-600/50 p-1.5 transition-colors duration-200 hover:bg-slate-500/60"
          aria-label={pendiente ? "Hay novedades sin leer" : "Ver novedades"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-orange-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          {pendiente && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-700" />}
        </button>
        <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800/95 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
          Novedades
        </span>
      </div>

      <Transition show={abierto} as={Fragment} appear>
        <Dialog as="div" className="relative z-[60]" onClose={cerrar}>
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
              <Dialog.Panel className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Novedades de FerreDesk</p>
                    <Dialog.Title className="mt-0.5 text-lg font-bold text-white">{NOVEDAD_ACTUAL.titulo}</Dialog.Title>
                  </div>
                  <button type="button" onClick={cerrar} className="text-slate-200 transition-colors hover:text-white" aria-label="Cerrar novedades">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 px-6 py-5">
                  <p className="text-sm leading-6 text-slate-600">{NOVEDAD_ACTUAL.descripcion}</p>

                  <a
                    href={NOVEDAD_ACTUAL.pdfUrl}
                    download="FerreDesk - Guia de Promociones.pdf"
                    onClick={() => {
                      marcarNovedadVista(username)
                      setPendiente(false)
                    }}
                    className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-orange-300 hover:bg-orange-50/50"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-6 w-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5m-7.5 3H12m-1.5-15.75H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">FerreDesk - Guia de Promociones.pdf</span>
                      <span className="mt-0.5 block text-xs text-slate-500">PDF · 1.6 MB</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-orange-600 group-hover:text-orange-700">
                      Descargar
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 12m0 0 4.5-4.5M12 12V3" />
                      </svg>
                    </span>
                  </a>
                </div>

                <div className="flex justify-end border-t border-slate-200 bg-white px-6 py-4">
                  <button
                    type="button"
                    onClick={cerrar}
                    className="rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-orange-700 hover:to-orange-800"
                  >
                    Entendido
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  )
}
