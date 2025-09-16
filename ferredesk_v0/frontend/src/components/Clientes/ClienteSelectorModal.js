"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../Buscador"
import Tabla from "../Tabla"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

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
  const theme = useFerreDeskTheme()
  const [termino, setTermino] = useState("")
  const [filaSeleccionada, setFilaSeleccionada] = useState(null)
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [buscando, setBuscando] = useState(false)

  // Definición de columnas para la tabla
  const columnas = [
    { id: "razon", titulo: "Razón Social / Nombre", align: "left" },
    { id: "fantasia", titulo: "Nombre Comercial", align: "left" },
    { id: "cuit", titulo: "CUIT / DNI", align: "left" },
    { id: "domicilio", titulo: "Domicilio", align: "left" },
    { id: "iva", titulo: "IVA", align: "left" },
    { id: "descuentos", titulo: "Desc. 1/2", align: "left" },
    { id: "seleccion", titulo: "Sel.", ancho: "60px", align: "center" }
  ]

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

  // Función para renderizar filas personalizadas
  const renderFila = (cli, idxVisible, indiceInicio) => {
    const selected = filaSeleccionada?.id === cli.id
    return (
      <tr
        key={cli.id}
        className={`text-sm hover:bg-orange-50 cursor-pointer transition-colors duration-150 ${
          selected ? "bg-orange-100/60" : ""
        }`}
        onDoubleClick={() => {
          onSeleccionar(cli)
          onCerrar()
        }}
        onClick={() => setFilaSeleccionada(cli)}
      >
        
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {cli.razon || cli.nombre}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {cli.fantasia || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {cli.cuit || cli.dni || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {cli.domicilio || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {cli.iva_nombre || cli.iva?.nombre || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {`${cli.descu1 || 0} / ${cli.descu2 || 0}`}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-center">
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
            <Dialog.Panel className="w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden">
              {/* Encabezado */}
              <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${theme.primario}`}>
                <Dialog.Title className="text-lg font-bold text-white">
                  Seleccionar Cliente
                </Dialog.Title>
                <button
                  onClick={onCerrar}
                  className="text-slate-200 hover:text-white transition-colors"
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
               {error ? (
                 <div className="p-8 text-center text-red-600">{error}</div>
               ) : (
                 <div className="px-6 pb-6" style={{ maxHeight: ALTURA_MAX_TABLA }}>
                   {termino.length < MIN_CARACTERES_BUSQUEDA ? (
                     <div className="text-center py-12 text-slate-500">
                       <p>Escribe al menos {MIN_CARACTERES_BUSQUEDA} caracteres para buscar...</p>
                     </div>
                   ) : (
                     <Tabla
                       columnas={columnas}
                       datos={resultadosBusqueda}
                       renderFila={renderFila}
                       mostrarBuscador={false}
                       mostrarOrdenamiento={false}
                       paginadorVisible={false}
                       sinEstilos={true}
                       cargando={cargando || buscando}
                     />
                   )}
                 </div>
               )}

              {/* Pie */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-white">
                <button
                  type="button"
                  disabled={!filaSeleccionada}
                  className="px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800"
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