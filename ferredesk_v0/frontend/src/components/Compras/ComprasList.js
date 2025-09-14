"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useCallback } from "react"
import Tabla from "../Tabla"
import { BotonEliminar, BotonVerDetalle } from "../Botones"
import AccionesMenu from "../Presupuestos y Ventas/herramientasforms/AccionesMenu"

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
  // Función para generar los botones de acciones para compras
  const generarBotonesCompra = (compra) => {
    return [
      {
        componente: BotonVerDetalle,
        onClick: () => onVerCompra(compra),
        titulo: "Ver detalle"
      },
      {
        componente: BotonEliminar,
        onClick: () => onEliminarCompra(compra.comp_id),
        titulo: "Eliminar compra"
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
    { id: "acciones", titulo: "", align: "center", ancho: 50 },
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
      <td className="px-2 py-1 text-center">
        <div className="flex items-center justify-center">
          <AccionesMenu botones={generarBotonesCompra(compra)} />
        </div>
      </td>
    </tr>
  ), [onVerCompra, onEliminarCompra])



  // Los errores se manejan con alertas del navegador, no se muestran en la UI

  return (
    <Tabla
      columnas={columnas}
      datos={compras}
      mostrarBuscador={true}
      mostrarOrdenamiento={true}
      valorBusqueda={search}
      onCambioBusqueda={setSearch}
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
  )
}

export default ComprasList
