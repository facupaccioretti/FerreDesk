"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../../Buscador"
import Tabla from "../../Tabla"
import { useFerreDeskTheme } from "../../../hooks/useFerreDeskTheme"

// --- Configuracion ---
export const ALTURA_MAX_TABLA = "60vh"
export const MIN_CARACTERES_BUSQUEDA = 1
export const TIPOS_COMPROBANTE_FACTURA = ["Factura", "factura", "factura_interna", "Factura Interna", "Cotizacion", "cotizacion"]
export const LETRA_FACTURA_INTERNA = "I"

/**
 * FacturaSelectorModal
 * Modal reutilizable para seleccionar una o varias facturas de un cliente.
 */
export default function FacturaSelectorModal({ abierto = false, cliente = null, soloFacturasInternas = false, onCerrar = () => {}, onSeleccionar = () => {} }) {
  const theme = useFerreDeskTheme()

  const [termino, setTermino] = useState("")
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([])

  useEffect(() => {
    if (abierto) {
      setTermino("")
      setSeleccionadas([])
      obtenerFacturas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cliente?.id])

  const obtenerFacturas = async () => {
    if (!cliente?.id) return
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        ven_idcli: cliente.id,
        para_nota_credito: "true",
        limit: "200",
      })
      const url = `/api/ventas/?${params.toString()}`

      const resp = await fetch(url, { credentials: "include" })
      if (!resp.ok) throw new Error("No se pudieron obtener las facturas")
      const data = await resp.json()
      const lista = Array.isArray(data) ? data : data.results || []

      const facturasValidas = lista.filter((f) => {
        const letra = f.comprobante?.letra
        const tipo = f.comprobante?.tipo

        if (soloFacturasInternas) {
          return letra === LETRA_FACTURA_INTERNA && tipo === "factura_interna"
        }

        return ["A", "B", "C"].includes(letra) && ["factura", "venta"].includes(tipo)
      })

      setFacturas(facturasValidas)
    } catch (err) {
      console.error("[FacturaSelectorModal] Error al obtener facturas:", err)
      setError(err.message || "Error desconocido")
    } finally {
      setCargando(false)
    }
  }

  const facturasFiltradas = useMemo(() => {
    let resultado = facturas

    if (termino.length >= MIN_CARACTERES_BUSQUEDA) {
      const lower = termino.toLowerCase()
      resultado = resultado.filter((f) => {
        const campos = [f.numero_formateado, f.numero, f.ven_fecha, f.ven_total, f.ven_estado]
        return campos.some((c) => String(c || "").toLowerCase().includes(lower))
      })
    }

    return resultado
  }, [facturas, termino])

  const getId = (fac) => fac.id ?? fac.ven_id ?? fac.idventa ?? fac.vdi_idve ?? fac.vdi_id ?? null

  const validarSeleccionLetras = (nuevasFacturas) => {
    if (nuevasFacturas.length <= 1) return { valido: true }

    const letras = [...new Set(nuevasFacturas.map((f) => f.comprobante?.letra))]

    if (letras.length > 1) {
      return {
        valido: false,
        mensaje: `No se pueden seleccionar facturas de distinto tipo.\nFacturas encontradas: ${letras.join(", ")}\n\nUna Nota de Credito solo puede anular facturas del mismo tipo.`,
      }
    }

    return { valido: true }
  }

  const toggleSeleccion = (fac) => {
    const id = getId(fac)
    if (id === null) return

    const nuevasSeleccionadas = seleccionadas.includes(id)
      ? seleccionadas.filter((s) => s !== id)
      : [...seleccionadas, id]

    const facturasNuevas = facturas.filter((f) => nuevasSeleccionadas.includes(getId(f)))
    const validacion = validarSeleccionLetras(facturasNuevas)

    if (!validacion.valido) {
      alert(validacion.mensaje)
      return
    }

    setSeleccionadas(nuevasSeleccionadas)
  }

  const estaSeleccionada = (fac) => seleccionadas.includes(getId(fac))

  const handleConfirmar = () => {
    const elegidas = facturas.filter((f) => seleccionadas.includes(getId(f)))
    onSeleccionar(elegidas)
  }

  const columnas = [
    {
      id: "seleccion",
      titulo: "Sel.",
      align: "center",
      ancho: "60px",
      render: (fila) => (
        estaSeleccionada(fila) ? (
          <div className="w-4 h-4 bg-orange-600 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 border-2 border-slate-300 rounded"></div>
        )
      )
    },
    {
      id: "numero",
      titulo: "Numero",
      align: "left",
      render: (fila) => (
        <span className="font-mono">{fila.numero_formateado || fila.numero}</span>
      )
    },
    {
      id: "fecha",
      titulo: "Fecha",
      align: "left",
      render: (fila) => fila.ven_fecha
    },
    {
      id: "total",
      titulo: "Total",
      align: "right",
      render: (fila) => `$${fila.ven_total}`
    }
  ]

  const renderFila = (fila, idxVisible, indiceInicio) => (
    <tr
      key={getId(fila)}
      className={`hover:bg-orange-50 cursor-pointer transition-colors duration-150 ${estaSeleccionada(fila) ? "bg-orange-100/60" : ""}`}
      onClick={() => toggleSeleccion(fila)}
    >
      {columnas.map((col) => (
        <td
          key={col.id}
          className={`px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white ${
            { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
          }`}
          style={col.ancho ? { width: col.ancho } : undefined}
        >
          {col.render ? col.render(fila, idxVisible, indiceInicio) : fila[col.id]}
        </td>
      ))}
    </tr>
  )

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
            <Dialog.Panel className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${theme.primario} text-white`}>
                <Dialog.Title className="text-lg font-bold">
                  Seleccionar Facturas de {cliente?.razon || cliente?.nombre || "cliente"}
                </Dialog.Title>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="text-white hover:text-slate-200 transition-colors"
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

              {error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : (
                <div className="px-6 pb-6" style={{ height: ALTURA_MAX_TABLA }}>
                  <Tabla
                    columnas={columnas}
                    datos={facturasFiltradas}
                    valorBusqueda=""
                    onCambioBusqueda={() => {}}
                    mostrarBuscador={false}
                    mostrarOrdenamiento={false}
                    paginadorVisible={false}
                    renderFila={renderFila}
                    sinEstilos={true}
                    cargando={cargando}
                  />
                </div>
              )}

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
                    className={`px-4 py-1.5 rounded-lg text-white transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${theme.botonPrimario}`}
                  >
                    Seleccionar
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
