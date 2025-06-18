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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(cli.id)}
                        title="Eliminar"
                        className="transition-colors px-1 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        {/* ícono eliminar */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Fila expandida */}
                {expandedClientId === cli.id && (
                  <tr className="bg-slate-50/50">
                    <td colSpan="3" className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                          <span className="block text-slate-500 font-medium">Código</span>
                          <span className="block text-slate-700 mt-1">{cli.codigo}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Razón Social</span>
                          <span className="block text-slate-700 mt-1">{cli.razon}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Nombre Comercial</span>
                          <span className="block text-slate-700 mt-1">{cli.fantasia}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">CUIT</span>
                          <span className="block text-slate-700 mt-1">{cli.cuit}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">IB</span>
                          <span className="block text-slate-700 mt-1">{cli.ib}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Estado</span>
                          <span className="block text-slate-700 mt-1">{cli.estado}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Dirección</span>
                          <span className="block text-slate-700 mt-1">{cli.domicilio}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 1</span>
                          <span className="block text-slate-700 mt-1">{cli.tel1}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 2</span>
                          <span className="block text-slate-700 mt-1">{cli.tel2}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Teléfono 3</span>
                          <span className="block text-slate-700 mt-1">{cli.tel3}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Email</span>
                          <span className="block text-slate-700 mt-1">{cli.email}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Contacto</span>
                          <span className="block text-slate-700 mt-1">{cli.contacto}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Comentario</span>
                          <span className="block text-slate-700 mt-1">{cli.comentario}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Código Postal</span>
                          <span className="block text-slate-700 mt-1">{cli.cpostal}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Zona</span>
                          <span className="block text-slate-700 mt-1">{barrios.find((b) => String(b.id) === String(cli.barrio))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Barrio</span>
                          <span className="block text-slate-700 mt-1">{localidades.find((l) => String(l.id) === String(cli.localidad))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Provincia</span>
                          <span className="block text-slate-700 mt-1">{provincias.find((p) => String(p.id) === String(cli.provincia))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Tipo de IVA</span>
                          <span className="block text-slate-700 mt-1">{tiposIVA.find((i) => String(i.id) === String(cli.iva))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Transporte</span>
                          <span className="block text-slate-700 mt-1">{transportes.find((t) => String(t.id) === String(cli.transporte))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Vendedor</span>
                          <span className="block text-slate-700 mt-1">{vendedores.find((v) => String(v.id) === String(cli.vendedor))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Plazo</span>
                          <span className="block text-slate-700 mt-1">{plazos.find((p) => String(p.id) === String(cli.plazo))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Categoría</span>
                          <span className="block text-slate-700 mt-1">{categorias.find((c) => String(c.id) === String(cli.categoria))?.nombre || ""}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Línea de Crédito</span>
                          <span className="block text-slate-700 mt-1">{cli.lineacred}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Importe Saldo Cta.</span>
                          <span className="block text-slate-700 mt-1">{cli.impsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Fecha Saldo Cta.</span>
                          <span className="block text-slate-700 mt-1">{cli.fecsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 1</span>
                          <span className="block text-slate-700 mt-1">{cli.descu1}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 2</span>
                          <span className="block text-slate-700 mt-1">{cli.descu2}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-medium">Descuento 3</span>
                          <span className="block text-slate-700 mt-1">{cli.descu3}</span>
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

export default ClientesTable 