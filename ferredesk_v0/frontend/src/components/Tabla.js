"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, Inbox } from "lucide-react"
import Paginador from "./Paginador"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const filtrarConComodines = (datos, terminoBusqueda) => {
  const termino = terminoBusqueda?.trim()
  if (!termino) return datos

  const palabras = termino.toLowerCase().split(/\s+/)

  if (palabras.length === 1) {
    return datos.filter((fila) =>
      JSON.stringify(fila).toLowerCase().includes(palabras[0])
    )
  }

  return datos.filter((fila) => {
    const texto = JSON.stringify(fila).toLowerCase()
    return palabras.every((p) => texto.includes(p))
  })
}

const ALIGN_CLASS = { left: "text-left", center: "text-center", right: "text-right" }

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------
const Tabla = ({
  columnas = [],
  datos = [],
  valorBusqueda = "",
  onCambioBusqueda = () => {},
  onBuscar = null,
  onLimpiar = null,
  filasPorPaginaInicial = 10,
  opcionesFilasPorPagina = [10, 20, 30, 40, 50],
  paginadorVisible = true,
  renderFila = null,
  mostrarBuscador = true,
  placeholderBuscador = "Buscar en tabla...",
  mostrarOrdenamiento = true,
  sinEstilos = false,
  tamañoEncabezado = "normal", // "normal" | "pequeño"
  filasCompactas = false,
  claseTbody = "",
  // Paginación controlada
  paginacionControlada = false,
  paginaActual: paginaControlada,
  onPageChange: onPageChangeControlada,
  itemsPerPage: itemsPerPageControlada,
  onItemsPerPageChange: onItemsPerPageChangeControlada,
  totalRemoto = null,
  busquedaRemota = false,
  // Ordenamiento remoto
  onOrdenamientoChange = null,
  ordenamientoControlado = null,
  // Carga
  cargando = false,
  // Clave personalizada
  customKey = null,
  // Renderizado responsivo para mobile
  renderCardMobile = null,
  // Variante de diseño
  variant = "default", // "default" | "ferredesk"
}) => {
  const [paginaActual, setPaginaActual] = useState(paginaControlada || 1)
  const [filasPorPagina, setFilasPorPagina] = useState(
    itemsPerPageControlada || filasPorPaginaInicial
  )
  const [ordenAscendente, setOrdenAscendente] = useState(false)

  useEffect(() => {
    if (paginacionControlada && paginaControlada) setPaginaActual(paginaControlada)
  }, [paginacionControlada, paginaControlada])

  useEffect(() => {
    if (paginacionControlada && itemsPerPageControlada)
      setFilasPorPagina(itemsPerPageControlada)
  }, [paginacionControlada, itemsPerPageControlada])

  useEffect(() => {
    if (!paginacionControlada) setPaginaActual(1)
  }, [valorBusqueda, datos, paginacionControlada])

  // Valor efectivo de ordenamiento (controlado vs local)
  const esAscendente =
    ordenamientoControlado !== null ? ordenamientoControlado : ordenAscendente

  const toggleOrden = () => {
    if (paginacionControlada && onOrdenamientoChange) {
      onOrdenamientoChange(!esAscendente)
    } else {
      setOrdenAscendente((prev) => !prev)
    }
  }

  const datosFiltrados = useMemo(() => {
    let resultado = datos

    if (!busquedaRemota && valorBusqueda) {
      resultado = filtrarConComodines(datos, valorBusqueda)
    }

    if (!paginacionControlada && mostrarOrdenamiento) {
      return [...resultado].sort((a, b) => {
        const idA = a.id || 0
        const idB = b.id || 0
        return esAscendente ? idA - idB : idB - idA
      })
    }

    return resultado
  }, [datos, valorBusqueda, esAscendente, mostrarOrdenamiento, paginacionControlada, busquedaRemota])

  const indiceInicio = (paginaActual - 1) * filasPorPagina
  const datosVisibles = paginacionControlada
    ? datosFiltrados
    : paginadorVisible
    ? datosFiltrados.slice(indiceInicio, indiceInicio + filasPorPagina)
    : datosFiltrados

  // Clases de celda (texto y padding)
  const esSmall = tamañoEncabezado === "pequeño"
  const pyFila = filasCompactas ? "py-1" : "py-2"
  const textSize = esSmall ? "text-xs" : "text-sm"
  const esFerredesk = variant === "ferredesk"
  const textBodySize = esFerredesk ? "text-sm" : textSize
  const clasesCeldaBase = `px-3 ${pyFila} ${textBodySize} ${esFerredesk ? "text-[#1e2d3d]" : "text-slate-700"} max-w-[200px] truncate`

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${
        sinEstilos ? "" : "bg-white rounded-lg border border-slate-200 shadow-sm"
      }`}
    >
      {/* Barra de controles */}
      {!sinEstilos && (mostrarBuscador || mostrarOrdenamiento || typeof onBuscar === "function" || typeof onLimpiar === "function") && (
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            {/* Buscador */}
            {mostrarBuscador && (
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={placeholderBuscador}
                  value={valorBusqueda}
                  onChange={(e) => onCambioBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && typeof onBuscar === "function") {
                      e.preventDefault()
                      onBuscar()
                    }
                  }}
                  className="pl-8 pr-3 py-1.5 sm:py-2 w-full rounded-md border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                />
              </div>
            )}

            {/* Grupo de Botones de Control */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end sm:justify-start">
              {typeof onBuscar === "function" && (
                <button
                  onClick={onBuscar}
                  className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3 sm:py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap"
                >
                  Buscar
                </button>
              )}

              {typeof onLimpiar === "function" && (
                <button
                  onClick={onLimpiar}
                  className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white hover:bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium rounded-md border border-slate-200 transition-colors whitespace-nowrap"
                >
                  Limpiar
                </button>
              )}

              {mostrarOrdenamiento && (
                <button
                  onClick={toggleOrden}
                  title={esAscendente ? "Más recientes primero" : "Más antiguos primero"}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-md border border-slate-200 bg-white transition-colors text-xs sm:text-sm font-medium ml-auto sm:ml-0"
                >
                  <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${esAscendente ? "rotate-180" : ""}`} />
                  <span className="hidden sm:inline">
                    {esAscendente ? "Más antiguos" : "Más recientes"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {/* Vista Mobile: Cards (solo si se provee renderCardMobile) */}
        {renderCardMobile && (
          <div className={`md:hidden space-y-3 p-4 ${
            cargando && datosVisibles.length > 0
              ? "opacity-40 pointer-events-none select-none"
              : ""
          } transition-opacity duration-200`}>
            {datosVisibles.length === 0 ? (
              <div className="py-14 text-center text-slate-400 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
                {cargando ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-orange-600" />
                    <p className="text-sm">Cargando...</p>
                  </>
                ) : (
                  <>
                    <Inbox className="w-8 h-8 text-slate-300" />
                    <p className="text-sm">
                      {valorBusqueda
                        ? "Sin resultados para la búsqueda"
                        : "No hay datos para mostrar"}
                    </p>
                  </>
                )}
              </div>
            ) : (
              datosVisibles.map((fila, idxVisible) => {
                const rowKey = customKey
                  ? customKey(fila, idxVisible)
                  : fila.id ?? indiceInicio + idxVisible
                return (
                  <div key={rowKey}>
                    {renderCardMobile(fila, idxVisible, indiceInicio)}
                  </div>
                )
              })
            )}
          </div>
        )}

        <table className={`min-w-full border-collapse ${renderCardMobile ? "hidden md:table" : ""}`}>
          <thead className="sticky top-0 z-10">
            <tr className={esFerredesk ? "bg-[#1e2d3d] border-b border-slate-700" : "bg-slate-800 border-b border-slate-700"}>
              {columnas.map((col) => {
                const thClasses = esFerredesk
                  ? "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-300"
                  : `px-3 ${esSmall ? "py-1.5" : "py-2"} ${textSize} font-semibold text-slate-100`
                  
                return (
                  <th
                    key={col.id}
                    className={`${thClasses} ${
                      ALIGN_CLASS[col.align || "left"]
                    } whitespace-nowrap`}
                    style={col.ancho ? { width: col.ancho } : undefined}
                  >
                    {esFerredesk ? col.titulo : col.titulo.charAt(0).toUpperCase() + col.titulo.slice(1).toLowerCase()}
                  </th>
                )
              })}
            </tr>
          </thead>

          {/*
            Patrón stale-while-revalidate: si hay datos y se está cargando la
            página siguiente, se atenúan las filas existentes en lugar de
            destruirlas, preservando el contexto visual del usuario.
          */}
          <tbody
            className={`divide-y divide-slate-100 ${claseTbody} ${
              cargando && datosVisibles.length > 0
                ? "opacity-40 pointer-events-none select-none"
                : ""
            } transition-opacity duration-200`}
          >
            {datosVisibles.map((fila, idxVisible) => {
              if (typeof renderFila === "function") {
                return renderFila(fila, idxVisible, indiceInicio)
              }

              const rowKey = customKey
                ? customKey(fila, idxVisible)
                : fila.id ?? indiceInicio + idxVisible

              const rowClasses = esFerredesk
                ? `border-b border-slate-100 last:border-0 transition-colors duration-100 ${idxVisible % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-100/60`
                : "bg-white hover:bg-orange-50/40 transition-colors duration-100"

              return (
                <tr
                  key={rowKey}
                  className={rowClasses}
                >
                  {columnas.map((col) => {
                    const contenido = col.render
                      ? col.render(fila, idxVisible, indiceInicio)
                      : fila[col.id]
                    return (
                      <td
                        key={col.id}
                        className={`${clasesCeldaBase} ${ALIGN_CLASS[col.align || "left"]}`}
                        style={col.ancho ? { width: col.ancho } : undefined}
                        title={typeof contenido === "string" ? contenido : undefined}
                      >
                        {contenido}
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Estado vacío / cargando */}
            {datosVisibles.length === 0 && (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="py-14 text-center text-slate-400 bg-white"
                >
                  {cargando ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-orange-600" />
                      <p className="text-sm">Cargando...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Inbox className="w-8 h-8 text-slate-300" />
                      <p className="text-sm">
                        {valorBusqueda
                          ? "Sin resultados para la búsqueda"
                          : "No hay datos para mostrar"}
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      {paginadorVisible && !sinEstilos && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <Paginador
            totalItems={totalRemoto ?? datosFiltrados.length}
            itemsPerPage={filasPorPagina}
            currentPage={paginaActual}
            onPageChange={(p) =>
              paginacionControlada ? onPageChangeControlada?.(p) : setPaginaActual(p)
            }
            onItemsPerPageChange={(n) => {
              if (paginacionControlada) {
                onItemsPerPageChangeControlada?.(n)
              } else {
                setFilasPorPagina(n)
                setPaginaActual(1)
              }
            }}
            opcionesItemsPorPagina={opcionesFilasPorPagina}
          />
        </div>
      )}
    </div>
  )
}

export default Tabla
