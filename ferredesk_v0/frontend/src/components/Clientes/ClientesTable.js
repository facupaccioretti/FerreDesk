"use client"

import React, { useState, useEffect } from "react"
import Paginador from "../Paginador"

// Tabla de clientes con búsqueda, paginación y expansión de detalles
// Código trasladado directamente desde ClientesManager.js

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
  const filtered = (clientes || []).filter(
    (cli) =>
      cli &&
      ((cli.razon ? cli.razon.toLowerCase() : "").includes(search.toLowerCase()) ||
        (cli.fantasia ? cli.fantasia.toLowerCase() : "").includes(search.toLowerCase())),
  )

  // ------------------------------ Paginación ------------------------------
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(10)

  useEffect(() => {
    setPaginaActual(1)
  }, [search, clientes])

  const indiceInicio = (paginaActual - 1) * itemsPorPagina
  const clientesVisibles = filtered.slice(indiceInicio, indiceInicio + itemsPorPagina)

  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          className="pl-4 pr-4 py-2 w-full rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-auto flex-1">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                RAZÓN SOCIAL
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                NOMBRE COMERCIAL
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 tracking-wider uppercase">
                ACCIONES
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {clientesVisibles.map((cli) => (
              <React.Fragment key={cli.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedClientId(expandedClientId === cli.id ? null : cli.id)}
                        className={`flex items-center justify-center w-6 h-6 mr-2 text-slate-600 hover:text-orange-600 transition-all duration-200 ${
                          expandedClientId === cli.id ? "rotate-90" : "rotate-0"
                        }`}
                        aria-label={expandedClientId === cli.id ? "Ocultar detalles" : "Mostrar detalles"}
                        style={{ padding: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                          <polygon points="5,3 15,10 5,17" />
                        </svg>
                      </button>
                      <span>{cli.razon}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{cli.fantasia}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => onEdit(cli)}
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
                        onClick={() => onDelete(cli.id)}
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
                  </td>
                </tr>

                {/* Fila expandida */}
                {expandedClientId === cli.id && (
                  <tr>
                    <td colSpan="3" className="px-0 py-0">
                      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-l-4 border-orange-500 mx-3 mb-2 rounded-lg shadow-sm">
                        <div className="p-4">
                          {/* Header con información clave */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-4">
                              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-orange-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                Detalles del Cliente
                              </h4>
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                                Código: {cli.codigo}
                              </span>
                            </div>
                            {(() => {
                              const estado = cli.activo === "A" ? "Activo" : "Inactivo"
                              return (
                                <div className="text-right">
                                  <div className="text-sm text-slate-600">Estado</div>
                                  <div
                                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                      estado === "Activo"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {estado}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>

                          {/* Contenido principal en grid compacto */}
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
                                <svg
                                  className="w-4 h-4 text-purple-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                  />
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      <Paginador
        totalItems={filtered.length}
        itemsPerPage={itemsPorPagina}
        currentPage={paginaActual}
        onPageChange={setPaginaActual}
        onItemsPerPageChange={(n) => {
          setItemsPorPagina(n)
          setPaginaActual(1)
        }}
      />
    </div>
  )
}

ClientesTable.defaultProps = {
  expandedClientId: null,
  setExpandedClientId: () => {},
}

export default ClientesTable;
