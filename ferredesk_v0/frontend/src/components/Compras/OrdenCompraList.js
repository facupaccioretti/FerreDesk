"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useCallback } from "react"
import Tabla from "../Tabla"
import { BotonEliminar, BotonVerDetalle, BotonEditar, BotonConvertir, BotonGenerarPDF } from "../Botones"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"

const OrdenCompraList = ({
  ordenesCompra,
  loading,
  error,
  onEditarOrdenCompra,
  onVerOrdenCompra,
  onConvertirOrdenCompra,
  onEliminarOrdenCompra,
  onGenerarPDF,
  // Props de paginación
  paginacionControlada = false,
  paginaActual,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalRemoto,
  // Props de ordenamiento
  onOrdenamientoChange = null,
  ordenamientoControlado = null,
  cargando = false,
}) => {
  // Función para generar los botones de acciones para órdenes de compra
  const generarBotonesOrdenCompra = (orden) => {
    return [
      {
        componente: BotonGenerarPDF,
        onClick: () => onGenerarPDF(orden),
        titulo: "Generar PDF"
      },
      {
        componente: BotonVerDetalle,
        onClick: () => onVerOrdenCompra(orden),
        titulo: "Ver detalle"
      },
      {
        componente: BotonEditar,
        onClick: () => onEditarOrdenCompra(orden),
        titulo: "Editar orden"
      },
      {
        componente: BotonConvertir,
        onClick: () => onConvertirOrdenCompra(orden),
        titulo: "Convertir a Compra"
      },
      {
        componente: BotonEliminar,
        onClick: () => onEliminarOrdenCompra(orden.ord_id),
        titulo: "Eliminar orden"
      }
    ]
  }

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
    { id: "acciones", titulo: "", align: "center", ancho: 50 },
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
      <td className="px-2 py-1 text-center">
        <div className="flex items-center justify-center">
          <AccionesMenu botones={generarBotonesOrdenCompra(orden)} />
        </div>
      </td>
    </tr>
  ), [onVerOrdenCompra, onEditarOrdenCompra, onConvertirOrdenCompra, onEliminarOrdenCompra, onGenerarPDF])

  // Los errores se manejan con alertas del navegador, no se muestran en la UI

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <Tabla
        columnas={columnas}
        datos={ordenesCompra}
        mostrarOrdenamiento={true}
        renderFila={renderFila}
        cargando={cargando}
        // Paginación controlada
        paginacionControlada={paginacionControlada}
        paginaActual={paginaActual}
        onPageChange={onPageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={onItemsPerPageChange}
        totalRemoto={totalRemoto}
        busquedaRemota={true}
        // Ordenamiento
        onOrdenamientoChange={onOrdenamientoChange}
        ordenamientoControlado={ordenamientoControlado}
      />
    </div>
  )
}

export default OrdenCompraList
