"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useCallback } from "react"
import Tabla from "../Tabla"
import { BotonEliminar } from "../Botones"

const ComprasList = ({
  compras,
  loading,
  error,
  search,
  setSearch,
  onNuevaCompra,
  onEditarCompra,
  onVerCompra,
  onCerrarCompra,
  onAnularCompra,
  onEliminarCompra,
  onRefresh,
}) => {

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

  const columnas = [
    { id: "compra", titulo: "Compra" },
    { id: "fecha", titulo: "Fecha" },
    { id: "proveedor", titulo: "Proveedor" },
    { id: "total", titulo: "Total", align: "right", ancho: 140 },
    { id: "items", titulo: "Items", align: "center", ancho: 90 },
    { id: "acciones", titulo: "Acciones", align: "right", ancho: 160 },
  ]

  const renderFila = useCallback((compra, idxVisible, indiceInicio) => (
    <tr key={compra.comp_id} className="hover:bg-slate-200 transition-colors">
      <td className="px-2 py-1">
        <div className="text-sm font-medium text-gray-900">{compra.comp_numero_factura}</div>
      </td>
      <td className="px-2 py-1 text-sm text-gray-900">{formatDate(compra.comp_fecha)}</td>
      <td className="px-2 py-1">
        <div className="text-sm font-medium text-gray-900">{compra.proveedor_nombre || compra.comp_razon_social}</div>
      </td>
      {/* Columna tipo y estado removidas */}
      <td className="px-2 py-1 text-sm font-medium text-right text-gray-900">{formatCurrency(compra.comp_total_final)}</td>
      <td className="px-2 py-1 text-sm text-center text-gray-500">{compra.cantidad_items || 0}</td>
      <td className="px-2 py-1 text-right">
        <div className="flex justify-end gap-2">
          {/* Acciones estandarizadas importadas de Botones */}
          {/* Botón Ver */}
          <button onClick={() => onVerCompra(compra)} className="transition-colors px-1 py-1 text-gray-700 hover:text-black" title="Ver detalle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
          {/* No hay edición ni cierre: las compras se crean finalizadas */}
          <BotonEliminar onClick={() => onEliminarCompra(compra.comp_id)} title="Eliminar" />
        </div>
      </td>
    </tr>
  ), [onVerCompra, onEliminarCompra])



  // Los errores se manejan con alertas del navegador, no se muestran en la UI
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <p>No se pudieron cargar las compras</p>
        </div>
      </div>
    )
  }

  return (
    <Tabla
      columnas={columnas}
      datos={compras}
      mostrarBuscador={true}
      valorBusqueda={search}
      onCambioBusqueda={setSearch}
      renderFila={renderFila}
      cargando={loading}
    />
  )
}

export default ComprasList
