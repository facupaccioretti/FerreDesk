"use client"

import React from "react"
import Tabla from "../Tabla" // Importamos la tabla genérica

// Tabla de clientes con búsqueda, paginación y expansión de detalles basada en Tabla.js

const ClientesTable = ({
  clientes,
  onEdit,
  onDelete,
  search,
  setSearch,
  expandedClientId,
  setExpandedClientId,
  barrios,
  localidades,
  provincias,
  tiposIVA,
  transportes,
  vendedores,
  plazos,
  categorias,
}) => {
  // ---------------------------------------------------------------------------
  // Definición de columnas (encabezados) para Tabla
  // ---------------------------------------------------------------------------
  const columnas = [
    {
      id: "__indice",
      titulo: "Nº",
      ancho: "48px",
      align: "center",
      render: (_fila, idxVisible, indiceInicio) => indiceInicio + idxVisible + 1,
    },
    {
      id: "razon",
      titulo: "RAZÓN SOCIAL",
      render: (cli) => <span className="text-sm font-medium text-slate-800">{cli.razon}</span>,
    },
    {
      id: "fantasia",
      titulo: "NOMBRE COMERCIAL",
      render: (cli) => <span className="text-sm text-slate-600">{cli.fantasia}</span>,
    },
    {
      id: "__acciones",
      titulo: "ACCIONES",
      ancho: "120px",
      render: (cli) => (
        <div className="flex gap-2 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(cli)
            }}
            title="Editar"
            className="transition-colors px-1 py-1 text-[#0055A4] hover:text-[#004488] hover:bg-blue-50 rounded"
          >
            {/* ícono editar */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(cli.id)
            }}
            title="Eliminar"
            className="transition-colors px-1 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
          >
            {/* ícono eliminar */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Generador personalizado de filas para manejar la expansión de detalles
  // ---------------------------------------------------------------------------
  const renderFila = (cli, idxVisible, indiceInicio) => {
    return (
      <React.Fragment key={cli.id}>
        {/* Fila principal */}
        <tr
          className="hover:bg-slate-200 transition-colors cursor-pointer"
          onClick={() => setExpandedClientId(expandedClientId === cli.id ? null : cli.id)}
        >
          {columnas.map((col) => {
            const contenido = col.render
              ? col.render(cli, idxVisible, indiceInicio)
              : cli[col.id]
            const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
            return (
              <td
                key={col.id}
                className={`px-2 py-1 whitespace-nowrap text-sm ${alignClass}`}
                style={col.ancho ? { width: col.ancho } : undefined}
              >
                {contenido}
              </td>
            )
          })}
        </tr>

        {/* Fila expandida */}
        {expandedClientId === cli.id && (
          <tr>
            <td colSpan={columnas.length} className="px-0 py-0">
              {/* Contenido detallado reutilizado del componente original */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-l-4 border-orange-500 mx-3 mb-2 rounded-lg shadow-sm">
                <div className="p-4">
                  {/* Sin cabecera: el wrapper naranjo se mantiene, toda info pasa a tarjetas */}

                  {/* Aquí mantenemos el grid de detalles tal cual estaba */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Información Básica */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Información Básica
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Código:</span>
                          <span className="font-medium text-slate-700">{cli.codigo || "N/A"}</span>
                        </div>
                        {(() => {
                          const estado = cli.activo === "A" ? "Activo" : "Inactivo"
                          return (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Estado:</span>
                              <span
                                className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                                  estado === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}
                              >
                                {estado}
                              </span>
                            </div>
                          )
                        })()}
                        <div className="flex justify-between">
                          <span className="text-slate-500">CUIT:</span>
                          <span className="font-medium text-slate-700">{cli.cuit || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">IB:</span>
                          <span className="font-medium text-slate-700">{cli.ib || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tipo IVA:</span>
                          <span className="font-medium text-slate-700">
                            {tiposIVA.find((i) => String(i.id) === String(cli.iva))?.nombre || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nombre Comercial:</span>
                          <span className="font-medium text-slate-700 truncate" title={cli.fantasia}>
                            {cli.fantasia || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Información de Contacto */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                        Contacto
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Teléfono 1:</span>
                          <span className="font-medium text-slate-700">{cli.tel1 || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Teléfono 2:</span>
                          <span className="font-medium text-slate-700">{cli.tel2 || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Email:</span>
                          <span className="font-medium text-slate-700 truncate" title={cli.email}>
                            {cli.email || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Contacto:</span>
                          <span className="font-medium text-slate-700 truncate" title={cli.contacto}>
                            {cli.contacto || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ubicación */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Ubicación
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Dirección:</span>
                          <span className="font-medium text-slate-700 truncate" title={cli.domicilio}>
                            {cli.domicilio || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Zona:</span>
                          <span className="font-medium text-slate-700">
                            {barrios.find((b) => String(b.id) === String(cli.barrio))?.nombre || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Localidad:</span>
                          <span className="font-medium text-slate-700">
                            {localidades.find((l) => String(l.id) === String(cli.localidad))?.nombre || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">C.P.:</span>
                          <span className="font-medium text-slate-700">{cli.cpostal || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Información Comercial y Financiera */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <h5 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-amber-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                          />
                        </svg>
                        Comercial
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vendedor:</span>
                          <span className="font-medium text-slate-700">
                            {vendedores.find((v) => String(v.id) === String(cli.vendedor))?.nombre || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Categoría:</span>
                          <span className="font-medium text-slate-700">
                            {categorias.find((c) => String(c.id) === String(cli.categoria))?.nombre || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Línea Crédito:</span>
                          <span className="font-medium text-slate-700">{cli.lineacred || "$0"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Descuentos:</span>
                          <span className="font-medium text-slate-700 text-xs">
                            {cli.descu1 || "0"}% | {cli.descu2 || "0"}% | {cli.descu3 || "0"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información adicional si existe */}
                  {cli.comentario && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <h6 className="font-medium text-slate-700 mb-1 flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-slate-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                          </svg>
                          Comentarios
                        </h6>
                        <p className="text-slate-700 text-sm">{cli.comentario}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }

  // ---------------------------------------------------------------------------
  // Filtrado de clientes para pasarlo a Tabla (la búsqueda global la gestiona Tabla)
  // Tabla no filtra por visibilidad de datos nulos; podemos replicar anterior
  // ---------------------------------------------------------------------------
  const clientesFiltrados = (clientes || []).filter(
    (cli) => cli && ((cli.razon ? cli.razon.toLowerCase() : "").includes(search.toLowerCase()) || (cli.fantasia ? cli.fantasia.toLowerCase() : "").includes(search.toLowerCase())),
  )

  return (
    <Tabla
      columnas={columnas}
      datos={clientesFiltrados}
      valorBusqueda={search}
      onCambioBusqueda={setSearch}
      filasPorPaginaInicial={10}
      renderFila={renderFila}
    />
  )
}

ClientesTable.defaultProps = {
  expandedClientId: null,
  setExpandedClientId: () => {},
}

export default ClientesTable;
