"use client"

import { Fragment, useState, useEffect } from "react"
import { Dialog, Transition } from "@headlessui/react"
import Buscador from "../Buscador"
import Tabla from "../Tabla"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

// Constantes descriptivas para la UI
const DEBOUNCE_DELAY = 300 // ms

/**
 * ProveedorSelectorModal
 * Componente modal reutilizable para seleccionar un proveedor.
 *
 * Props:
 *  - abierto: boolean            -> controla visibilidad
 *  - onCerrar: function()         -> callback para cerrar sin seleccionar
 *  - onSeleccionar: function(prov) -> callback con el proveedor elegido
 *  - cargando: boolean            -> opcional, muestra spinner
 *  - error: string               -> opcional, muestra mensaje de error
 */
export default function ProveedorSelectorModal({
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
    { id: "razon", titulo: "Razón Social", align: "left" },
    { id: "fantasia", titulo: "Nombre de Fantasía", align: "left" },
    { id: "cuit", titulo: "CUIT", align: "left" },
    { id: "domicilio", titulo: "Domicilio", align: "left" },
    { id: "tel1", titulo: "Teléfono", align: "left" },
    { id: "seleccion", titulo: "Sel.", ancho: "60px", align: "center" }
  ]

  // Reiniciar al abrir y cargar proveedores iniciales
  useEffect(() => {
    if (abierto) {
      setTermino("")
      setFilaSeleccionada(null)
      setResultadosBusqueda([])
      setBuscando(false)
      
      // Cargar todos los proveedores inmediatamente al abrir
      cargarProveedores("")
    }
  }, [abierto])

  // Función para cargar proveedores
  const cargarProveedores = (terminoBusqueda) => {
    setBuscando(true)
    const url = terminoBusqueda.length > 0 
      ? `/api/productos/proveedores/?search=${encodeURIComponent(terminoBusqueda)}`
      : `/api/productos/proveedores/?acti=`
      
    fetch(url)
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
        console.error("Error al buscar proveedores:", err)
        setResultadosBusqueda([]) // Limpiar en caso de error
      })
      .finally(() => {
        setBuscando(false)
      })
  }

  // Lógica de búsqueda "debounced" contra la API
  useEffect(() => {
    if (!abierto) return // No hacer búsqueda si el modal está cerrado
    
    const timerId = setTimeout(() => {
      cargarProveedores(termino)
    }, termino.length > 0 ? DEBOUNCE_DELAY : 0) // Sin delay si no hay término de búsqueda

    return () => clearTimeout(timerId) // Limpieza del temporizador
  }, [termino, abierto])

  // Función para renderizar filas personalizadas
  const renderFila = (prov, idxVisible, indiceInicio) => {
    const selected = filaSeleccionada?.id === prov.id
    return (
      <tr
        key={prov.id}
        className={`text-sm hover:bg-orange-50 cursor-pointer transition-colors duration-150 ${
          selected ? "bg-orange-100/60" : ""
        }`}
        onDoubleClick={() => {
          onSeleccionar(prov)
          onCerrar()
        }}
        onClick={() => setFilaSeleccionada(prov)}
      >
        
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {prov.razon || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {prov.fantasia || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {prov.cuit || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {prov.domicilio || "-"}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 bg-white text-left">
          {prov.tel1 || "-"}
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
                  Seleccionar Proveedor
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
                  placeholder="Buscar proveedores..."
                />
              </div>

              {/* Contenido */}
              {error ? (
                <div className="p-8 text-center text-red-600">{error}</div>
              ) : (
                <div className="px-6 pb-6">
                  <div className="max-h-80 overflow-auto">
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
                  </div>
                </div>
              )}

              {/* Pie */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-white">
                <button
                  type="button"
                  disabled={!filaSeleccionada}
                  className={`px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${theme.botonPrimario}`}
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
