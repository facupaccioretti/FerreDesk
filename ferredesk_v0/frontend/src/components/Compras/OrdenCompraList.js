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
  const generarBotonesOrdenCompra = useCallback((orden) => {
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
  }, [onGenerarPDF, onVerOrdenCompra, onEditarOrdenCompra, onConvertirOrdenCompra, onEliminarOrdenCompra])

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
  ), [generarBotonesOrdenCompra])

  const renderCardMobile = useCallback((orden) => {
    return (
      <div
        key={orden.ord_id}
        className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 hover:border-orange-200 transition-colors mb-3 flex flex-col gap-2"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Proveedor</span>
            <p className="font-semibold text-slate-800 text-sm truncate">
              {orden.proveedor_nombre || orden.ord_razon_social}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2">
          <div>
            <span className="text-slate-500 block">Orden N°</span>
            <span className="font-medium text-slate-700 font-mono">{orden.ord_numero || "-"}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Fecha</span>
            <span className="font-medium text-slate-700">{formatDate(orden.ord_fecha)}</span>
          </div>
        </div>

        <div className="flex justify-between items-end border-t border-slate-100 pt-2 mt-1">
          <div>
            <span className="text-[10px] text-slate-500 block leading-none mb-1">Ítems</span>
            <span className="font-semibold text-slate-800 text-sm">
              {orden.cantidad_items || 0}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <AccionesMenu botones={generarBotonesOrdenCompra(orden)} />
          </div>
        </div>
      </div>
    )
  }, [generarBotonesOrdenCompra])

  // Los errores se manejan con alertas del navegador, no se muestran en la UI

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <Tabla
        columnas={columnas}
        datos={ordenesCompra}
        mostrarOrdenamiento={true}
        renderFila={renderFila}
        renderCardMobile={renderCardMobile}
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
