"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Tabla from "../Tabla"

const ComprasList = ({
  compras,
  loading,
  error,
  onNuevaCompra,
  onEditarCompra,
  onVerCompra,
  onCerrarCompra,
  onAnularCompra,
  onEliminarCompra,
  onRefresh,
}) => {
  const [filters, setFilters] = useState({
    comp_fecha_after: "",
    comp_fecha_before: "",
    comp_tipo: "",
    comp_estado: "",
    comp_idpro: "",
    comp_numero_factura: "",
    comp_razon_social: "",
    comp_cuit: "",
  })
  const [showFilters, setShowFilters] = useState(false)

  const applyFilters = () => {
    const activeFilters = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "") {
        activeFilters[key] = value
      }
    })
    onRefresh(activeFilters)
  }

  const clearFilters = () => {
    setFilters({
      comp_fecha_after: "",
      comp_fecha_before: "",
      comp_tipo: "",
      comp_estado: "",
      comp_idpro: "",
      comp_numero_factura: "",
      comp_razon_social: "",
      comp_cuit: "",
    })
    onRefresh()
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "BORRADOR":
        return "bg-yellow-100 text-yellow-800"
      case "CERRADA":
        return "bg-green-100 text-green-800"
      case "ANULADA":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case "COMPRA":
        return "bg-blue-100 text-blue-800"
      case "COMPRA_INTERNA":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "-"
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es })
    } catch {
      return dateString
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return "$0,00"
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error al cargar las compras</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const columnas = [
    { id: "compra", titulo: "Compra" },
    { id: "fecha", titulo: "Fecha" },
    { id: "proveedor", titulo: "Proveedor" },
    { id: "tipo", titulo: "Tipo", align: "center", ancho: 120 },
    { id: "estado", titulo: "Estado", align: "center", ancho: 120 },
    { id: "total", titulo: "Total", align: "right", ancho: 140 },
    { id: "items", titulo: "Items", align: "center", ancho: 90 },
    { id: "acciones", titulo: "Acciones", align: "right", ancho: 160 },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Lista de Compras ({compras.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showFilters ? "Ocultar" : "Mostrar"} Filtros
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Actualizar
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
                <input
                  type="date"
                  value={filters.comp_fecha_after}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_fecha_after: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
                <input
                  type="date"
                  value={filters.comp_fecha_before}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_fecha_before: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={filters.comp_tipo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="COMPRA">Compra</option>
                  <option value="COMPRA_INTERNA">Compra Interna</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={filters.comp_estado}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_estado: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="BORRADOR">Borrador</option>
                  <option value="CERRADA">Cerrada</option>
                  <option value="ANULADA">Anulada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Factura</label>
                <input
                  type="text"
                  value={filters.comp_numero_factura}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_numero_factura: e.target.value }))}
                  placeholder="Buscar por número..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                <input
                  type="text"
                  value={filters.comp_razon_social}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_razon_social: e.target.value }))}
                  placeholder="Buscar por proveedor..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                <input
                  type="text"
                  value={filters.comp_cuit}
                  onChange={(e) => setFilters((prev) => ({ ...prev, comp_cuit: e.target.value }))}
                  placeholder="Buscar por CUIT..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Aplicar Filtros
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {compras.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay compras</h3>
          <p className="mt-1 text-sm text-gray-500">Comienza creando una nueva compra.</p>
          <div className="mt-6">
            <button
              onClick={onNuevaCompra}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nueva Compra
            </button>
          </div>
        </div>
      ) : (
        <Tabla
          columnas={columnas}
          datos={compras}
          mostrarBuscador={false}
          renderFila={(compra, idxVisible, indiceInicio) => (
            <tr key={compra.comp_id} className="hover:bg-slate-200 transition-colors">
              <td className="px-3 py-2">
                <div className="text-sm font-medium text-gray-900">{compra.comp_numero_factura}</div>
                <div className="text-xs text-gray-500">ID: {compra.comp_id}</div>
              </td>
              <td className="px-3 py-2 text-sm text-gray-900">{formatDate(compra.comp_fecha)}</td>
              <td className="px-3 py-2">
                <div className="text-sm font-medium text-gray-900">{compra.proveedor_nombre || compra.comp_razon_social}</div>
                <div className="text-xs text-gray-500">{compra.comp_cuit}</div>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTipoColor(compra.comp_tipo)}`}>
                  {compra.tipo_display || compra.comp_tipo}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(compra.comp_estado)}`}>
                  {compra.estado_display || compra.comp_estado}
                </span>
              </td>
              <td className="px-3 py-2 text-sm font-medium text-right text-gray-900">{formatCurrency(compra.comp_total_final)}</td>
              <td className="px-3 py-2 text-sm text-center text-gray-500">{compra.cantidad_items || 0}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => onVerCompra(compra)} className="text-blue-600 hover:text-blue-900" title="Ver detalles">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {compra.comp_estado === "BORRADOR" && (
                    <>
                      <button onClick={() => onEditarCompra(compra)} className="text-indigo-600 hover:text-indigo-900" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => onCerrarCompra(compra.comp_id)} className="text-green-600 hover:text-green-900" title="Cerrar compra">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </>
                  )}
                  {compra.comp_estado !== "ANULADA" && (
                    <button onClick={() => onAnularCompra(compra.comp_id)} className="text-red-600 hover:text-red-900" title="Anular compra">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {compra.comp_estado === "BORRADOR" && (
                    <button onClick={() => onEliminarCompra(compra.comp_id)} className="text-red-600 hover:text-red-900" title="Eliminar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  )
}

export default ComprasList
