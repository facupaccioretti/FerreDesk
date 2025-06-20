"use client"

import React, { useState, useEffect, useMemo } from "react"
import Paginador from "./Paginador"

// -----------------------------------------------------------------------------
// Constantes de estilo
// -----------------------------------------------------------------------------
// Espaciados básicos aplicados a todas las celdas.  Mantener aquí para que un
// cambio visual se propague de inmediato a todas las tablas.
const ESPACIO_HORIZONTAL_CELDA = "px-2"  // Clase Tailwind para padding-x
const ESPACIO_VERTICAL_CELDA   = "py-1"  // Clase Tailwind para padding-y

// Clases comunes que comparten todas las celdas (texto pequeño y «nowrap» para
// un diseño compacto).
const CLASES_CELDA_BASE = `${ESPACIO_HORIZONTAL_CELDA} ${ESPACIO_VERTICAL_CELDA} whitespace-nowrap text-sm text-slate-700`

// -----------------------------------------------------------------------------
// Tabla genérica y compacta
// -----------------------------------------------------------------------------
/**
 * Componente de tabla genérico y compacto.
 *
 * Props principales:
 *  - columnas: Array<{
 *      id: string                 // clave del dato (ignorar si usa render)
 *      titulo: string             // encabezado visible
 *      ancho?: string             // ej. '120px' (Tailwind permite 'w-24', etc.)
 *      align?: 'left'|'center'|'right'
 *      render?: (fila, indiceVisible, indiceGlobal) => ReactNode  // celda custom
 *      // NOTA: si deseas manejar filas de detalle, define renderFila en Tabla
 *    }>
 *  - datos: Array<Object>         // filas a renderizar
 *  - valorBusqueda: string        // término de búsqueda
 *  - onCambioBusqueda: Function   // callback al cambiar búsqueda
 *  - filasPorPaginaInicial: number
 *  - opcionesFilasPorPagina: number[]
 *  - renderFila?: (fila, indiceVisible, indiceGlobal) => ReactNode | ReactNode[]
 *                 // Si se provee, Tabla delega completamente el render de las
 *                 // filas a esta función, permitiendo filas adicionales.
 */
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
}) => {
  // ---------------------------------------------------------------------------
  // Estado de búsqueda, página actual y filas por página
  // ---------------------------------------------------------------------------
  const [paginaActual, setPaginaActual] = useState(1)
  const [filasPorPagina, setFilasPorPagina] = useState(filasPorPaginaInicial)

  // Reiniciar a página 1 cuando cambian el término de búsqueda o la fuente de datos
  useEffect(() => {
    setPaginaActual(1)
  }, [valorBusqueda, datos])

  // ---------------------------------------------------------------------------
  // Filtro rápido: convierte fila a string y busca «valorBusqueda»
  // ---------------------------------------------------------------------------
  const datosFiltrados = useMemo(() => {
    if (!valorBusqueda) return datos
    const termino = valorBusqueda.toLowerCase()
    return datos.filter((fila) => JSON.stringify(fila).toLowerCase().includes(termino))
  }, [datos, valorBusqueda])

  // ---------------------------------------------------------------------------
  // Paginación (si está habilitada)
  // ---------------------------------------------------------------------------
  const indiceInicio = (paginaActual - 1) * filasPorPagina
  const datosVisibles = paginadorVisible
    ? datosFiltrados.slice(indiceInicio, indiceInicio + filasPorPagina)
    : datosFiltrados

  // ---------------------------------------------------------------------------
  // Renderizado
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      {mostrarBuscador && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Buscar…"
            className="pl-3 pr-3 py-2 w-full rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            value={valorBusqueda}
            onChange={(e) => onCambioBusqueda(e.target.value)}
          />
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-auto flex-1">
        <table className="min-w-full">
          {/* Encabezado */}
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
              {columnas.map((col) => (
                <th
                  key={col.id}
                  className={`${{ left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]} ${CLASES_CELDA_BASE} font-semibold text-xs tracking-wider uppercase`}
                  style={col.ancho ? { width: col.ancho } : undefined}
                >
                  {col.titulo}
                </th>
              ))}
            </tr>
          </thead>

          {/* Cuerpo */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {datosVisibles.map((fila, idxVisible) => {
              const indiceGlobal = indiceInicio + idxVisible

              // Si existe renderFila lo usamos y asumimos que devuelve <tr> o un array de <tr>
              if (typeof renderFila === "function") {
                return renderFila(fila, idxVisible, indiceInicio)
              }

              // Renderizado por defecto por columnas
              return (
                <tr key={fila.id || indiceGlobal} className="hover:bg-slate-50 transition-colors">
                  {columnas.map((col) => {
                    const contenido = col.render
                      ? col.render(fila, idxVisible, indiceInicio)
                      : fila[col.id]
                    return (
                      <td
                        key={col.id}
                        className={`${CLASES_CELDA_BASE} ${{ left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]}`}
                        style={col.ancho ? { width: col.ancho } : undefined}
                      >
                        {contenido}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      {paginadorVisible && (
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

export default Tabla; 