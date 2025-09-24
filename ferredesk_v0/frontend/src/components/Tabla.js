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

// Nota: la variante compacta se calcula dentro del componente para acceder a props

// -----------------------------------------------------------------------------
// Función para búsqueda por comodines
// -----------------------------------------------------------------------------
const filtrarConComodines = (datos, terminoBusqueda) => {
  if (!terminoBusqueda || !terminoBusqueda.trim()) {
    return datos
  }

  // Dividir el término en palabras individuales
  const palabras = terminoBusqueda.toLowerCase().trim().split(/\s+/)
  
  if (palabras.length === 0) {
    return datos
  }

  // Si solo hay una palabra, usar búsqueda tradicional para mantener compatibilidad
  if (palabras.length === 1) {
    const termino = palabras[0]
    return datos.filter((fila) => JSON.stringify(fila).toLowerCase().includes(termino))
  }

  // Búsqueda por comodines: TODAS las palabras deben estar presentes
  return datos.filter((fila) => {
    const textoCompleto = JSON.stringify(fila).toLowerCase()
    return palabras.every(palabra => textoCompleto.includes(palabra))
  })
}

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
  filasCompactas = false,
  claseTbody = "",
  // --- Nuevos props opcionales para paginación controlada ---
  paginacionControlada = false,
  paginaActual: paginaControlada,
  onPageChange: onPageChangeControlada,
  itemsPerPage: itemsPerPageControlada,
  onItemsPerPageChange: onItemsPerPageChangeControlada,
  totalRemoto = null,
  busquedaRemota = false,
  // --- Nuevos props para ordenamiento remoto ---
  onOrdenamientoChange = null,
  ordenamientoControlado = null, // Estado de ordenamiento desde el padre
  // --- Prop para estado de carga ---
  cargando = false,
}) => {
  const [paginaActual, setPaginaActual] = useState(paginaControlada || 1)
  const [filasPorPagina, setFilasPorPagina] = useState(itemsPerPageControlada || filasPorPaginaInicial)
  const [ordenAscendente, setOrdenAscendente] = useState(false)

  // Mantener sincronizado el estado interno cuando la paginación es controlada externamente
  useEffect(() => {
    if (paginacionControlada && paginaControlada) setPaginaActual(paginaControlada)
  }, [paginacionControlada, paginaControlada])
  useEffect(() => {
    if (paginacionControlada && itemsPerPageControlada) setFilasPorPagina(itemsPerPageControlada)
  }, [paginacionControlada, itemsPerPageControlada])

  useEffect(() => {
    if (!paginacionControlada) setPaginaActual(1)
  }, [valorBusqueda, datos, paginacionControlada])

  const datosFiltrados = useMemo(() => {
    let datosProcesados = datos

    // Si la búsqueda es remota, no filtramos localmente
    if (!busquedaRemota && valorBusqueda) {
      datosProcesados = filtrarConComodines(datos, valorBusqueda)
    }

    // En modo controlado no ordenamos localmente (lo debe hacer el servidor si aplica)
    if (!paginacionControlada && mostrarOrdenamiento) {
      return datosProcesados.sort((a, b) => {
        const idA = a.id || 0
        const idB = b.id || 0
        return ordenAscendente ? idA - idB : idB - idA
      })
    }

    return datosProcesados
  }, [datos, valorBusqueda, ordenAscendente, mostrarOrdenamiento, paginacionControlada, busquedaRemota])

  const indiceInicio = (paginaActual - 1) * filasPorPagina
  const datosVisibles = paginacionControlada
    ? datosFiltrados
    : (paginadorVisible ? datosFiltrados.slice(indiceInicio, indiceInicio + filasPorPagina) : datosFiltrados)

  // Clases calculadas según modo compacto para las celdas por defecto (cuando no se usa renderFila)
  const clasesCeldaBaseCalculadas = `${ESPACIO_HORIZONTAL_CELDA} ${
    filasCompactas ? ESPACIO_VERTICAL_CELDA_PEQUEÑA : ESPACIO_VERTICAL_CELDA
  } whitespace-nowrap ${tamañoEncabezado === "pequeño" ? "text-xs" : "text-sm"} text-slate-700`

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
              onClick={() => {
                if (paginacionControlada && onOrdenamientoChange) {
                  // En modo controlado, notificar al componente padre
                  const nuevoOrdenamiento = ordenamientoControlado !== null ? !ordenamientoControlado : !ordenAscendente;
                  onOrdenamientoChange(nuevoOrdenamiento);
                } else {
                  // En modo local, cambiar estado interno
                  setOrdenAscendente(!ordenAscendente);
                }
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg border border-slate-200 bg-white/80 transition-all duration-200 text-sm font-medium"
              title={
                (ordenamientoControlado !== null ? ordenamientoControlado : ordenAscendente) ? "Cambiar a orden descendente (más recientes primero)" : "Cambiar a orden ascendente (más antiguos primero)"
              }
            >
              <ArrowUpDown
                className={`w-4 h-4 transition-transform duration-200 ${(ordenamientoControlado !== null ? ordenamientoControlado : ordenAscendente) ? "rotate-180" : ""}`}
              />
              <span className="hidden sm:inline">{(ordenamientoControlado !== null ? ordenamientoControlado : ordenAscendente) ? "Más antiguos" : "Más recientes"}</span>
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
          <tbody className={`${filasCompactas ? "divide-y divide-slate-300" : "divide-y-2 divide-slate-300"} ${claseTbody}`}>
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
                        className={`${clasesCeldaBaseCalculadas} bg-white ${
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

            {/* Estado vacío o cargando */}
            {(cargando || datosVisibles.length === 0) && (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="text-center py-12 text-slate-500 bg-gradient-to-b from-slate-50/50 to-white/80"
                >
                  {!cargando && datosVisibles.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Search className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium">No se encontraron resultados</p>
                      {valorBusqueda && <p className="text-xs text-slate-400">Intenta con otros términos de búsqueda</p>}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                      <p className="text-sm font-medium">Cargando tabla</p>
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
        <div className="p-4 border-t border-slate-200/60 bg-gradient-to-r from-white/80 to-slate-50 rounded-b-xl">
          <Paginador
            totalItems={totalRemoto ?? datosFiltrados.length}
            itemsPerPage={filasPorPagina}
            currentPage={paginaActual}
            onPageChange={(p) => (paginacionControlada ? onPageChangeControlada?.(p) : setPaginaActual(p))}
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

Tabla.defaultProps = {
  columnas: [],
  datos: [],
  valorBusqueda: "",
  onCambioBusqueda: () => {},
  mostrarBuscador: true,
}

export default Tabla
