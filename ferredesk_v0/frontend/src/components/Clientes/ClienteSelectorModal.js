"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../Buscador"

// Constantes descriptivas para la UI
const ALTURA_MAX_TABLA = "60vh" // evita que la tabla crezca demasiado
const MIN_CARACTERES_BUSQUEDA = 3
const DEBOUNCE_DELAY = 300 // ms

/**
 * ClienteSelectorModal
 * Componente modal reutilizable para seleccionar un cliente.
 *
 * Props:
 *  - abierto: boolean            -> controla visibilidad
 *  - onCerrar: function()         -> callback para cerrar sin seleccionar
 *  - onSeleccionar: function(cli) -> callback con el cliente elegido
 *  - cargando: boolean            -> opcional, muestra spinner
 *  - error: string               -> opcional, muestra mensaje de error
 */
export default function ClienteSelectorModal({
  abierto = false,
  onCerrar = () => {},
  onSeleccionar = () => {},
  cargando = false,
  error = null,
}) {
  const [termino, setTermino] = useState("")
  const [filaSeleccionada, setFilaSeleccionada] = useState(null)
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)

  // Reiniciar al abrir
  useEffect(() => {
    if (abierto) {
      setTermino("")
      setFilaSeleccionada(null)
      setResultadosBusqueda([])
      setBuscando(false)
    }
  }, [abierto])

  // Lógica de búsqueda "debounced" contra la API
  useEffect(() => {
    if (termino.length < MIN_CARACTERES_BUSQUEDA) {
      setResultadosBusqueda([])
      setBuscando(false)
      return
    }

    setBuscando(true)
    const timerId = setTimeout(() => {
      // El backend de Django REST Framework puede devolver un objeto con 'results',
      // por eso accedemos a data.results o data.
      fetch(`/api/clientes/clientes/?search=${encodeURIComponent(termino)}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Error en la respuesta de la API")
          }
          return res.json()
        })
        .then((data) => {
          // El ViewSet de DRF usualmente pagina, así que los resultados están en `data.results`.
          // Si no está paginado, será `data`.
          console.log("Respuesta de la API:", data) // Debug: ver qué devuelve la API
          
          let resultados = data
          if (data && data.results) {
            resultados = data.results
          }
          
          // Asegurar que siempre sea un array
          if (!Array.isArray(resultados)) {
            console.warn("La API no devolvió un array:", resultados)
            resultados = []
          }
          
          setResultadosBusqueda(resultados)
        })
        .catch((err) => {
          console.error("Error al buscar clientes:", err)
          setResultadosBusqueda([]) // Limpiar en caso de error
        })
        .finally(() => {
          setBuscando(false)
        })
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(timerId) // Limpieza del temporizador
  }, [termino])

  return (
    <Transition show={abierto} as={Fragment} appear>
      <Dialog as="div" className="relative z-40" onClose={onCerrar}>
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
            <Dialog.Panel className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Encabezado */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <Dialog.Title className="text-lg font-bold text-slate-800">
                  Seleccionar Cliente
                </Dialog.Title>
                <button
                  onClick={onCerrar}
                  className="text-slate-600 hover:text-slate-800 transition-colors"
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

              {/* Buscador */}
              <div className="px-6 py-4">
                <Buscador
                  // 'items' ya no es necesario ya que la búsqueda es manejada por el backend
                  deshabilitarDropdown={true}
                  onInputChange={setTermino}
                  obtenerEtiqueta={() => termino}
                  placeholder="Buscar por código, razón social, CUIT..."
                />
              </div>

              {/* Contenido */}
              {cargando ? ( // Prop 'cargando' para una carga inicial general si fuese necesario
                <div className="p-8 text-center text-slate-500">Cargando...</div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : (
                <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: ALTURA_MAX_TABLA }}>
                  <table className="min-w-full table-auto">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr className="text-left text-slate-700 text-sm">
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Razón Social / Nombre</th>
                        <th className="px-3 py-2">Nombre Comercial</th>
                        <th className="px-3 py-2">CUIT / DNI</th>
                        <th className="px-3 py-2">Domicilio</th>
                        <th className="px-3 py-2">IVA</th>
                        <th className="px-3 py-2">Desc. 1/2</th>
                        <th className="px-3 py-2 text-center">Sel.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termino.length < MIN_CARACTERES_BUSQUEDA ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-500">
                            Escribe al menos {MIN_CARACTERES_BUSQUEDA} caracteres para buscar...
                          </td>
                        </tr>
                      ) : buscando ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-500">
                            Buscando cliente...
                          </td>
                        </tr>
                      ) : resultadosBusqueda.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-500">
                            No se encontraron resultados para "{termino}"
                          </td>
                        </tr>
                      ) : (
                        Array.isArray(resultadosBusqueda) ? resultadosBusqueda.map((cli) => {
                          const selected = filaSeleccionada?.id === cli.id
                          return (
                            <tr
                              key={cli.id}
                              className={`text-sm hover:bg-orange-50 cursor-pointer ${
                                selected ? "bg-orange-100/60" : ""
                              }`}
                              onDoubleClick={() => {
                                onSeleccionar(cli)
                                onCerrar()
                              }}
                              onClick={() => setFilaSeleccionada(cli)}
                            >
                              <td className="px-3 py-1 font-mono whitespace-nowrap">{cli.codigo}</td>
                              <td className="px-3 py-1">{cli.razon || cli.nombre}</td>
                              <td className="px-3 py-1">{cli.fantasia || "-"}</td>
                              <td className="px-3 py-1">{cli.cuit || cli.dni || "-"}</td>
                              <td className="px-3 py-1">{cli.domicilio || "-"}</td>
                              <td className="px-3 py-1">{cli.iva_nombre || cli.iva?.nombre || "-"}</td>
                              <td className="px-3 py-1">
                                {`${cli.descu1 || 0} / ${cli.descu2 || 0}`}
                              </td>
                              <td className="px-3 py-1 text-center">
                                {selected && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-4 h-4 text-orange-600"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm14.78-2.97a.75.75 0 00-1.06-1.06L9.75 14.19l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l6.75-6.75z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </td>
                            </tr>
                          )
                        }) : (
                          <tr>
                            <td colSpan={8} className="text-center py-6 text-red-500">
                              Error: Datos inválidos de la API
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pie */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-white">
                <button
                  type="button"
                  disabled={!filaSeleccionada}
                  className="px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800"
                  onClick={() => {
                    if (filaSeleccionada) {
                      onSeleccionar(filaSeleccionada)
                      onCerrar()
                    }
                  }}
                >
                  Seleccionar
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
} 