"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../../Buscador"

// --- Configuración ---
export const ALTURA_MAX_TABLA = "60vh" // Altura máxima de tabla dentro del modal
export const MIN_CARACTERES_BUSQUEDA = 1 // Mínimo de caracteres para que se active filtrado
// Array de posibles nombres para el tipo de comprobante "Factura" que la API podría esperar.
// Se utiliza el primer valor para la petición directa, los demás son para un posible filtrado local de respaldo.
export const TIPOS_COMPROBANTE_FACTURA = ["Factura", "factura"]

/**
 * FacturaSelectorModal
 * Modal reutilizable para seleccionar una o varias facturas de un cliente.
 *
 * Props:
 *  - abierto: boolean              -> controla visibilidad
 *  - cliente: object|null          -> cliente del cual buscar facturas
 *  - onCerrar: function()          -> callback para cerrar sin seleccionar
 *  - onSeleccionar: function(arr)  -> callback con array de facturas elegidas
 */
export default function FacturaSelectorModal({ abierto = false, cliente = null, onCerrar = () => {}, onSeleccionar = () => {} }) {
  // --- Estado interno ---
  const [termino, setTermino] = useState("")
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([]) // array de IDs seleccionados (string|number)

  // Reiniciar estado cada vez que abre o cambia cliente
  useEffect(() => {
    if (abierto) {
      setTermino("")
      setSeleccionadas([])
      obtenerFacturas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cliente?.id])

  // Fetch de facturas del cliente
  const obtenerFacturas = async () => {
    if (!cliente?.id) return
    setCargando(true)
    setError(null)
    try {
      // Construimos una URL que filtra directamente en el backend
      const params = new URLSearchParams({
        ven_idcli: cliente.id,
        // Usamos el nombre de parámetro correcto 'comprobante_tipo' y el primer valor del array.
        comprobante_tipo: TIPOS_COMPROBANTE_FACTURA[0],
      })
      const url = `/api/ventas/?${params.toString()}`
      const resp = await fetch(url, { credentials: "include" })
      if (!resp.ok) throw new Error("No se pudieron obtener las facturas")
      const data = await resp.json()
      // Normalizar para asegurar estructura mínima y soportar paginación
      const lista = Array.isArray(data) ? data : data.results || []
      // Como el backend ya filtró, no es necesario hacerlo de nuevo en el frontend
      setFacturas(lista)
    } catch (err) {
      console.error("[FacturaSelectorModal] Error al obtener facturas:", err)
      setError(err.message || "Error desconocido")
    } finally {
      setCargando(false)
    }
  }

  // Filtrado por término de búsqueda
  const facturasFiltradas = useMemo(() => {
    if (termino.length < MIN_CARACTERES_BUSQUEDA) return facturas
    const lower = termino.toLowerCase()
    return facturas.filter((f) => {
      const campos = [f.numero_formateado, f.numero, f.fecha, f.total, f.estado]
      return campos.some((c) => String(c || "").toLowerCase().includes(lower))
    })
  }, [facturas, termino])

  // Helpers de selección
  const getId = (fac) => fac.id ?? fac.ven_id ?? fac.idventa ?? fac.vdi_idve ?? fac.vdi_id ?? null

  const toggleSeleccion = (fac) => {
    const id = getId(fac)
    if (id === null) return
    setSeleccionadas((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }
  const estaSeleccionada = (fac) => seleccionadas.includes(getId(fac))

  // Confirmar selección
  const handleConfirmar = () => {
    const elegidas = facturas.filter((f) => seleccionadas.includes(getId(f)))
    onSeleccionar(elegidas)
  }

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
            <Dialog.Panel className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Encabezado */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <Dialog.Title className="text-lg font-bold text-slate-800">
                  Seleccionar Facturas de {cliente?.razon || cliente?.nombre || "cliente"}
                </Dialog.Title>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
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
                  items={facturas}
                  camposBusqueda={["numero_formateado", "numero", "fecha"]}
                  deshabilitarDropdown={true}
                  onInputChange={setTermino}
                  obtenerEtiqueta={() => termino}
                  placeholder="Buscar factura..."
                />
              </div>

              {/* Contenido */}
              {cargando ? (
                <div className="p-8 text-center text-slate-500">Cargando facturas…</div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : facturasFiltradas.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Sin resultados</div>
              ) : (
                <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: ALTURA_MAX_TABLA }}>
                  <table className="min-w-full table-auto text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr className="text-left text-slate-700">
                        <th className="px-3 py-2 text-center">Sel.</th>
                        <th className="px-3 py-2">Número</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasFiltradas.map((fac) => (
                        <tr
                          key={getId(fac)}
                          className={`hover:bg-orange-50 cursor-pointer ${estaSeleccionada(fac) ? "bg-orange-100/60" : ""}`}
                          onClick={() => toggleSeleccion(fac)}
                        >
                          <td className="px-3 py-1 text-center">
                            <input
                              type="checkbox"
                              tabIndex={0}
                              aria-label="Seleccionar factura"
                              checked={estaSeleccionada(fac)}
                              onChange={() => toggleSeleccion(fac)}
                            />
                          </td>
                          <td className="px-3 py-1 whitespace-nowrap font-mono">{fac.numero_formateado || fac.numero}</td>
                          <td className="px-3 py-1 whitespace-nowrap">{fac.fecha}</td>
                          <td className="px-3 py-1 whitespace-nowrap">${fac.total}</td>
                          <td className="px-3 py-1 whitespace-nowrap">{fac.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-600">
                  {seleccionadas.length} seleccionada{seleccionadas.length === 1 ? "" : "s"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onCerrar}
                    className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={seleccionadas.length === 0}
                    className="px-4 py-1.5 rounded-lg text-white transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
} 