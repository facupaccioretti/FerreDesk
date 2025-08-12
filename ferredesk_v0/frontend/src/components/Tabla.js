"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown } from "lucide-react"
import Paginador from "./Paginador"

// -----------------------------------------------------------------------------
// Constantes de estilo FerreDesk
// -----------------------------------------------------------------------------
const ESPACIO_HORIZONTAL_CELDA = "px-3"
const ESPACIO_VERTICAL_CELDA = "py-2"
const ESPACIO_VERTICAL_CELDA_PEQUEÑA = "py-1"

const CLASES_CELDA_BASE = `${ESPACIO_HORIZONTAL_CELDA} ${ESPACIO_VERTICAL_CELDA} whitespace-nowrap text-sm text-slate-700` // sin fondo

// -----------------------------------------------------------------------------
// Tabla genérica con estética FerreDesk
// -----------------------------------------------------------------------------
const Tabla = ({
  columnas = [],
  datos = [],
  valorBusqueda = "",
  onCambioBusqueda = () => {},
  filasPorPaginaInicial = 10,
  opcionesFilasPorPagina = [10, 20, 30, 40, 50],
  paginadorVisible = true,
  renderFila = null,
  mostrarBuscador = true,
  mostrarOrdenamiento = true,
  sinEstilos = false,
  tamañoEncabezado = "normal", // "normal" | "pequeño"
}) => {
  const [paginaActual, setPaginaActual] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(filasPorPaginaInicial)
  const [ordenAscendente, setOrdenAscendente] = useState(false)

  useEffect(() => {
    setPaginaActual(1)
  }, [valorBusqueda, datos])

  const datosFiltrados = useMemo(() => {
    let datosProcesados = datos

    if (valorBusqueda) {
      const termino = valorBusqueda.toLowerCase()
      datosProcesados = datos.filter((fila) => JSON.stringify(fila).toLowerCase().includes(termino))
    }

    return datosProcesados.sort((a, b) => {
      const idA = a.id || 0
      const idB = b.id || 0
      return ordenAscendente ? idA - idB : idB - idA
    })
  }, [datos, valorBusqueda, ordenAscendente])

  const indiceInicio = (paginaActual - 1) * filasPorPagina
  const datosVisibles = paginadorVisible
    ? datosFiltrados.slice(indiceInicio, indiceInicio + filasPorPagina)
    : datosFiltrados

  return (
    <div className={`flex flex-col h-full overflow-hidden ${sinEstilos ? '' : 'bg-gradient-to-br from-slate-50 via-white to-orange-50/20 rounded-xl border border-slate-200/60 shadow-sm'}`}>
      {/* Header con buscador y controles */}
      {!sinEstilos && (
        <div className="p-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white/80 rounded-t-xl">
        <div className="flex items-center justify-between gap-4">
          {/* Buscador */}
          {mostrarBuscador && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en tabla..."
                className="pl-10 pr-4 py-2.5 w-full rounded-lg border border-slate-200 bg-white/80 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all duration-200 text-sm"
                value={valorBusqueda}
                onChange={(e) => onCambioBusqueda(e.target.value)}
              />
            </div>
          )}

          {/* Control de ordenamiento */}
          {mostrarOrdenamiento && (
            <button
              onClick={() => setOrdenAscendente(!ordenAscendente)}
              className="flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg border border-slate-200 bg-white/80 transition-all duration-200 text-sm font-medium"
              title={
                ordenAscendente ? "Orden descendente (más recientes primero)" : "Orden ascendente (más antiguos primero)"
              }
            >
              <ArrowUpDown
                className={`w-4 h-4 transition-transform duration-200 ${ordenAscendente ? "rotate-180" : ""}`}
              />
              <span className="hidden sm:inline">{ordenAscendente ? "Más antiguos" : "Más recientes"}</span>
            </button>
          )}
        </div>
        </div>
      )}

      {/* Contenedor de tabla */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full rounded-lg overflow-hidden">
          {/* Encabezado */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600">
              {columnas.map((col) => (
                <th
                  key={col.id}
                  className={`${
                    { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
                  } ${ESPACIO_HORIZONTAL_CELDA} ${tamañoEncabezado === "pequeño" ? ESPACIO_VERTICAL_CELDA_PEQUEÑA : ESPACIO_VERTICAL_CELDA} font-semibold ${tamañoEncabezado === "pequeño" ? "text-xs" : "text-sm"} text-slate-100 bg-gradient-to-b from-transparent to-slate-800/20`}
                  style={col.ancho ? { width: col.ancho } : undefined}
                >
                  {col.titulo.charAt(0).toUpperCase() + col.titulo.slice(1).toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>

          {/* Cuerpo */}
          <tbody className="divide-y-2 divide-slate-300">
            {datosVisibles.map((fila, idxVisible) => {
              const indiceGlobal = indiceInicio + idxVisible

              // Si existe renderFila lo usamos y asumimos que devuelve <tr> o un array de <tr>
              if (typeof renderFila === "function") {
                return renderFila(fila, idxVisible, indiceInicio)
              }

              // Renderizado por defecto por columnas
              return (
                <tr key={fila.id || indiceGlobal} className="hover:bg-slate-200 transition-colors duration-150">
                  {columnas.map((col) => {
                    const contenido = col.render ? col.render(fila, idxVisible, indiceInicio) : fila[col.id]
                    return (
                      <td
                        key={col.id}
                        className={`${CLASES_CELDA_BASE} bg-white ${
                          { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
                        }`}
                        style={col.ancho ? { width: col.ancho } : undefined}
                      >
                        {contenido}
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Estado vacío */}
            {datosVisibles.length === 0 && (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="text-center py-12 text-slate-500 bg-gradient-to-b from-slate-50/50 to-white/80"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium">No se encontraron resultados</p>
                    {valorBusqueda && <p className="text-xs text-slate-400">Intenta con otros términos de búsqueda</p>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      {paginadorVisible && !sinEstilos && (
        <div className="p-4 border-t border-slate-200/60 bg-gradient-to-r from-white/80 to-slate-50 rounded-b-xl">
          <Paginador
            totalItems={datosFiltrados.length}
            itemsPerPage={filasPorPagina}
            currentPage={paginaActual}
            onPageChange={setPaginaActual}
            onItemsPerPageChange={(n) => {
              setFilasPorPagina(n)
              setPaginaActual(1)
            }}
            opcionesItemsPorPagina={opcionesFilasPorPagina}
          />
        </div>
      )}
    </div>
  )
}

Tabla.defaultProps = {
  columnas: [],
  datos: [],
  valorBusqueda: "",
  onCambioBusqueda: () => {},
  mostrarBuscador: true,
}

export default Tabla
