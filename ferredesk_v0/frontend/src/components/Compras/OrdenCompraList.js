"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useCallback } from "react"
import Tabla from "../Tabla"
import { BotonEliminar, BotonVerDetalle, BotonEditar, BotonConvertir } from "../Botones"

const OrdenCompraList = ({
  ordenesCompra,
  loading,
  error,
  onEditarOrdenCompra,
  onVerOrdenCompra,
  onConvertirOrdenCompra,
  onEliminarOrdenCompra,
}) => {

  const formatDate = (dateString) => {
    if (!dateString) return "-"
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es })
    } catch {
      return dateString
    }
  }

  const columnas = [
    { id: "orden", titulo: "Orden" },
    { id: "fecha", titulo: "Fecha" },
    { id: "proveedor", titulo: "Proveedor" },
    { id: "items", titulo: "Items", align: "center", ancho: 90 },
    { id: "acciones", titulo: "Acciones", align: "right", ancho: 200 },
  ]

  const renderFila = useCallback((orden, idxVisible, indiceInicio) => (
    <tr key={orden.ord_id} className="hover:bg-slate-200 transition-colors">
      <td className="px-2 py-1">
        <div className="text-sm font-medium text-gray-900">{orden.ord_numero}</div>
      </td>
      <td className="px-2 py-1 text-sm text-gray-900">{formatDate(orden.ord_fecha)}</td>
      <td className="px-2 py-1">
        <div className="text-sm font-medium text-gray-900">{orden.proveedor_nombre || orden.ord_razon_social}</div>
      </td>
      <td className="px-2 py-1 text-sm text-center text-gray-500">{orden.cantidad_items || 0}</td>
      <td className="px-2 py-1 text-right">
        <div className="flex justify-end gap-1">
          <BotonVerDetalle onClick={() => onVerOrdenCompra(orden)} title="Ver detalle" />
          <BotonEditar onClick={() => onEditarOrdenCompra(orden)} title="Editar" />
          <BotonConvertir onClick={() => onConvertirOrdenCompra(orden)} title="Convertir a Compra" />
          <BotonEliminar onClick={() => onEliminarOrdenCompra(orden.ord_id)} title="Eliminar" />
        </div>
      </td>
    </tr>
  ), [onVerOrdenCompra, onEditarOrdenCompra, onConvertirOrdenCompra, onEliminarOrdenCompra])

  // Los errores se manejan con alertas del navegador, no se muestran en la UI
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <p>No se pudieron cargar las órdenes de compra</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <Tabla
        columnas={columnas}
        datos={ordenesCompra}
        renderFila={renderFila}
        loading={loading}
        mensajeVacio="No hay órdenes de compra"
      />
    </div>
  )
}

export default OrdenCompraList
