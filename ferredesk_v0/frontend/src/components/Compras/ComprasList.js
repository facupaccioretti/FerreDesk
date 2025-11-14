"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useCallback } from "react"
import Tabla from "../Tabla"
import { BotonEliminar, BotonVerDetalle, BotonEditar } from "../Botones"
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
  // Botón custom para cerrar compra (solo visible cuando está abierta)
  const BotonCerrarCompra = ({ onClick, titulo }) => (
    <button
      onClick={onClick}
      title={titulo}
      className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 focus:outline-none"
      aria-label={titulo}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    </button>
  )

  // Función para generar los botones de acciones para compras (memoizada)
  const generarBotonesCompra = useCallback((compra) => {
    const botones = [
      {
        componente: BotonVerDetalle,
        onClick: () => onVerCompra(compra),
        titulo: "Ver detalle"
      }
    ]

    // Agregar botones solo si está en BORRADOR (abierta)
    if (compra.comp_estado === 'BORRADOR') {
      botones.push({
        componente: BotonEditar,
        onClick: () => onEditarCompra(compra),
        titulo: "Editar compra"
      })
      
      botones.push({
        componente: BotonCerrarCompra,
        onClick: () => {
          const confirmar = window.confirm("¿Está seguro de cerrar la compra? Esta acción no se puede deshacer.")
          if (!confirmar) return
          onCerrarCompra(compra.comp_id)
        },
        titulo: "Cerrar compra"
      })
      
      // Agregar botón eliminar solo si está en BORRADOR
      botones.push({
        componente: BotonEliminar,
        onClick: () => onEliminarCompra(compra.comp_id),
        titulo: "Eliminar compra"
      })
    }

    return botones
  }, [onVerCompra, onEditarCompra, onCerrarCompra, onEliminarCompra])

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
    { id: "estado", titulo: "Estado", align: "center", ancho: 110 },
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
      <td className="px-2 py-1 text-sm text-center">
        {compra.comp_estado === 'BORRADOR' && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Abierta</span>
        )}
        {compra.comp_estado === 'CERRADA' && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cerrada</span>
        )}
        {compra.comp_estado === 'ANULADA' && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Anulada</span>
        )}
      </td>
      <td className="px-2 py-1 text-sm font-medium text-right text-gray-900">{formatCurrency(compra.comp_total_final)}</td>
      <td className="px-2 py-1 text-sm text-center text-gray-500">{compra.cantidad_items || 0}</td>
      <td className="px-2 py-1 text-center">
        <div className="flex items-center justify-center">
          <AccionesMenu botones={generarBotonesCompra(compra)} />
        </div>
      </td>
    </tr>
  ), [generarBotonesCompra])



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
