import React from "react"
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from "../ComprobanteIcono"
import { BotonEditar, BotonEliminar, BotonGenerarPDF, BotonConvertir, BotonVerDetalle, BotonNotaCredito } from "../Botones"
import ComprobanteAsociadoTooltip from "./herramientasforms/ComprobanteAsociadoTooltip"
import TooltipFacturado from "./herramientasforms/TooltipFacturado"
import AccionesMenu from "./herramientasforms/AccionesMenu"
import { formatearMoneda } from "./herramientasforms/plantillasComprobantes/helpers"
import Tabla from "../Tabla"

/**
 * Función para obtener el icono y etiqueta de un comprobante
 * @param {string} tipo - Tipo de comprobante
 * @param {string} nombre - Nombre del comprobante
 * @param {string} letra - Letra del comprobante
 * @returns {Object} - Objeto con icon y label
 */
const getComprobanteIconAndLabel = (tipo, nombre = "", letra = "") => {
  const t = String(tipo || "").toLowerCase()
  const n = String(nombre || "").toLowerCase()
  // Normalización sin acentos para robustez
  const sinAcentos = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const nClean = sinAcentos(n)
  if (nClean.includes("presupuesto")) return { icon: <IconPresupuesto />, label: "Presupuesto" }
  if (nClean.includes("venta")) return { icon: <IconVenta />, label: "Venta" }
  if (t === 'nota_credito_interna') {
    return { icon: <IconCredito />, label: "Modif. de Contenido" }
  }
  if (t === 'nota_credito' || nClean.includes('nota de credito')) {
    return { icon: <IconCredito />, label: "N. Cred." }
  }
  if (nClean.includes("nota de debito")) return { icon: <IconCredito />, label: "N. Débito" }
  if (nClean.includes("recibo")) return { icon: <IconRecibo />, label: "Recibo" }
  if (nClean.includes("factura")) return { icon: <IconFactura />, label: "Factura" }
  return { icon: <IconFactura />, label: String(nombre) }
}


/**
 * Función para generar los botones de acciones según el tipo de comprobante
 * @param {Object} comprobante - Datos del comprobante
 * @param {Object} acciones - Funciones de acciones disponibles
 * @param {boolean} isFetchingForConversion - Estado de carga para conversión
 * @param {number} fetchingPresupuestoId - ID del presupuesto siendo convertido
 * @param {Function} esFacturaInternaConvertible - Función para verificar si es factura interna convertible
 * @returns {Array} - Array de botones para el AccionesMenu
 */
const generarBotonesComprobante = (comprobante, acciones, isFetchingForConversion, fetchingPresupuestoId, esFacturaInternaConvertible) => {
  const {
    handleImprimir,
    openVistaTab,
    handleEdit,
    handleConvertir,
    handleDelete,
    handleConvertirFacturaI,
    handleNotaCredito,
  } = acciones

  // Función para determinar si una factura puede tener NC
  const puedeTenerNotaCredito = (comp) => {
    const esFactura = comp.comprobante?.tipo === 'factura' ||
      comp.comprobante?.tipo === 'venta' ||
      comp.comprobante?.tipo === 'factura_interna';
    const letraValida = ['A', 'B', 'C', 'I'].includes(comp.comprobante?.letra);
    const estaCerrada = comp.estado === 'Cerrado';
    return esFactura && letraValida && estaCerrada;
  };

  const botones = []

  // Verificar si es Presupuesto (único tipo que puede tener botón de eliminar)
  // Excluir explícitamente: Modif. de Contenido, Cotizaciones, Extensión de Contenido, etc.
  const esPresupuesto = comprobante.tipo === "Presupuesto"
  const tipoComprobanteOriginal = comprobante.comprobante?.tipo || ""
  const esComprobanteNoEliminable = [
    'nota_credito_interna',  // Modif. de Contenido
    'nota_debito_interna',   // Extensión de Contenido
    'factura_interna',        // Cotización
    'nota_credito',           // Nota de Crédito
    'nota_debito',            // Nota de Débito
    'factura',                // Factura
    'venta'                   // Venta
  ].includes(tipoComprobanteOriginal.toLowerCase())

  // Solo Presupuestos pueden tener botón de eliminar
  const puedeEliminar = esPresupuesto && !esComprobanteNoEliminable

  // Presupuesto abierto
  if (puedeEliminar && comprobante.estado === "Abierto") {
    botones.push(
      {
        componente: BotonGenerarPDF,
        onClick: () => handleImprimir(comprobante),
        titulo: "Generar PDF"
      },
      // {
      //   componente: BotonVerTicket,
      //   onClick: () => handleVerTicket(comprobante),
      //   titulo: "Ver Ticket"
      // },
      {
        componente: BotonVerDetalle,
        onClick: () => openVistaTab(comprobante),
        titulo: "Ver detalle"
      },
      {
        componente: BotonEditar,
        onClick: () => handleEdit(comprobante),
        titulo: "Editar"
      }
    )

    // Solo mostrar botón de convertir si NO está ya convertida
    if (!comprobante.convertida_a_fiscal) {
      botones.push({
        componente: BotonConvertir,
        onClick: () => handleConvertir(comprobante),
        titulo: isFetchingForConversion && fetchingPresupuestoId === comprobante.id ? "Cargando..." : "Convertir",
        disabled: isFetchingForConversion && fetchingPresupuestoId === comprobante.id
      })
    }

    botones.push({
      componente: BotonEliminar,
      onClick: () => handleDelete(comprobante.id),
      titulo: "Eliminar"
    })
  }
  // Facturas cerradas que pueden tener NC
  else if (puedeTenerNotaCredito(comprobante)) {
    const esFacturaInternaConvertibleActual = comprobante.comprobante?.tipo === 'factura_interna' &&
      esFacturaInternaConvertible(comprobante);

    botones.push(
      {
        componente: BotonGenerarPDF,
        onClick: () => handleImprimir(comprobante),
        titulo: "Generar PDF"
      },
      // {
      //   componente: BotonVerTicket,
      //   onClick: () => handleVerTicket(comprobante),
      //   titulo: "Ver Ticket"
      // },
      {
        componente: BotonVerDetalle,
        onClick: () => openVistaTab(comprobante),
        titulo: "Ver detalle"
      },
      {
        componente: BotonNotaCredito,
        onClick: () => handleNotaCredito(comprobante),
        titulo: comprobante.comprobante?.tipo === 'factura_interna'
          ? "Crear Modificación de Contenido"
          : "Crear Nota de Crédito"
      }
    )

    // Botón de conversión para facturas internas
    if (esFacturaInternaConvertibleActual) {
      botones.push({
        componente: BotonConvertir,
        onClick: () => handleConvertirFacturaI(comprobante),
        titulo: isFetchingForConversion && fetchingPresupuestoId === comprobante.id ? "Cargando..." : "Convertir a Factura",
        disabled: isFetchingForConversion && fetchingPresupuestoId === comprobante.id
      })
    }

  }
  // Venta cerrada (sin botón NC)
  else if (comprobante.tipo === "Venta" && comprobante.estado === "Cerrado") {
    botones.push(
      {
        componente: BotonGenerarPDF,
        onClick: () => handleImprimir(comprobante),
        titulo: "Generar PDF"
      },
      // {
      //   componente: BotonVerTicket,
      //   onClick: () => handleVerTicket(comprobante),
      //   titulo: "Ver Ticket"
      // },
      {
        componente: BotonVerDetalle,
        onClick: () => openVistaTab(comprobante),
        titulo: "Ver detalle"
      }
    )
  }
  // Otros casos (solo ver y generar PDF)
  else {
    botones.push(
      {
        componente: BotonVerDetalle,
        onClick: () => openVistaTab(comprobante),
        titulo: "Ver detalle"
      },
      // {
      //   componente: BotonVerTicket,
      //   onClick: () => handleVerTicket(comprobante),
      //   titulo: "Ver Ticket"
      // },
      {
        componente: BotonGenerarPDF,
        onClick: () => handleImprimir(comprobante),
        titulo: "Generar PDF"
      }
    )
  }

  return botones
}

/**
 * Componente para renderizar las acciones de un comprobante según su tipo y estado
 * @param {Object} props - Props del componente
 * @param {Object} props.comprobante - Datos del comprobante
 * @param {Object} props.acciones - Funciones de acciones disponibles
 * @param {boolean} props.isFetchingForConversion - Estado de carga para conversión
 * @param {number} props.fetchingPresupuestoId - ID del presupuesto siendo convertido
 * @param {Function} props.esFacturaInternaConvertible - Función para verificar si es factura interna convertible
 * @returns {JSX.Element} - Menú de acciones con botón de 3 puntos
 */
const ComprobanteAcciones = ({
  comprobante,
  acciones,
  isFetchingForConversion,
  fetchingPresupuestoId,
  esFacturaInternaConvertible,
}) => {
  const botones = generarBotonesComprobante(comprobante, acciones, isFetchingForConversion, fetchingPresupuestoId, esFacturaInternaConvertible)

  return (
    <AccionesMenu botones={botones} />
  )
}

/**
 * Componente principal para la lista de comprobantes
 * Extraído de PresupuestosManager.js
 */
const ComprobantesList = ({
  comprobantes,
  datosPagina,
  acciones,
  isFetchingForConversion,
  fetchingPresupuestoId,
  esFacturaInternaConvertible,
  totalItems,
  itemsPorPagina,
  paginaActual,
  setPaginaActual,
  setItemsPorPagina,
}) => {
  const columnas = [
    { id: "comprobante", titulo: "Comprobante", align: "left", ancho: "22%" },
    { id: "numero", titulo: "N°", align: "left", ancho: "32%" },
    { id: "fecha", titulo: "Fecha", align: "left", ancho: "14%" },
    { id: "cliente", titulo: "Cliente", align: "left", ancho: "18%" },
    { id: "total", titulo: "Total", align: "right", ancho: "14%" },
    { id: "acciones", titulo: "", align: "left", ancho: "50px" },
  ]

  const renderFila = (p) => {
    // Obtener datos del comprobante
    let comprobanteObj = null
    if (typeof p.comprobante === "object" && p.comprobante !== null) {
      comprobanteObj = p.comprobante
    } else if (p.comprobante) {
      comprobanteObj = (comprobantes || []).find((c) => c.id === p.comprobante) || null
    }

    const comprobanteNombre = comprobanteObj ? comprobanteObj.nombre : ""
    const comprobanteLetra = comprobanteObj ? comprobanteObj.letra : ""
    const comprobanteTipo = comprobanteObj ? comprobanteObj.tipo : ""

    const { icon, label } = getComprobanteIconAndLabel(
      comprobanteTipo,
      comprobanteNombre,
      comprobanteLetra,
    )

    // Quitar letra del numero_formateado si existe
    let numeroSinLetra = p.numero_formateado
    if (numeroSinLetra && comprobanteLetra && numeroSinLetra.startsWith(comprobanteLetra + " ")) {
      numeroSinLetra = numeroSinLetra.slice(comprobanteLetra.length + 1)
    }

    // Lógica para mostrar tooltips de comprobantes asociados
    const notasCreditoAsociadas = p.notas_credito_que_la_anulan || []
    const facturasAnuladas = p.facturas_anuladas || []
    const tieneNotasCredito = notasCreditoAsociadas.length > 0
    const tieneFacturasAnuladas = facturasAnuladas.length > 0

    return (
      <tr key={p.id} className="hover:bg-slate-200">
        {/* Comprobante */}
        <td className="px-2 py-0.5 whitespace-nowrap">
          <div className="flex items-center">
            <div className="flex items-center gap-2 text-slate-700">
              {icon} <span className="font-medium">{label}</span>
            </div>
            {tieneNotasCredito && (
              <ComprobanteAsociadoTooltip
                documentos={notasCreditoAsociadas}
                titulo="Comprobantes Asociados"
              />
            )}
            {tieneFacturasAnuladas && (
              <ComprobanteAsociadoTooltip
                documentos={facturasAnuladas}
                titulo="Comprobantes Asociados"
              />
            )}
          </div>
        </td>

        {/* Número */}
        <td className="px-2 py-0.5 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              {(comprobanteLetra ? comprobanteLetra + " " : "") + (numeroSinLetra || p.numero)}
            </span>
            {p.convertida_a_fiscal && p.factura_fiscal_info && (
              <TooltipFacturado facturaInfo={p.factura_fiscal_info} />
            )}
          </div>
        </td>

        {/* Fecha */}
        <td className="px-2 py-0.5 whitespace-nowrap text-slate-600">{p.fecha}</td>

        {/* Cliente */}
        <td className="px-2 py-0.5 whitespace-nowrap text-slate-700 font-medium">{p.cliente}</td>

        {/* Total */}
        <td className="px-2 py-0.5 whitespace-nowrap text-right">
          <span className="font-semibold text-slate-800 min-w-[64px]">${formatearMoneda(p.total)}</span>
        </td>

        {/* Acciones */}
        <td className="px-2 py-0.5 whitespace-nowrap">
          <div className="flex gap-1">
            <ComprobanteAcciones
              comprobante={p}
              acciones={acciones}
              isFetchingForConversion={isFetchingForConversion}
              fetchingPresupuestoId={fetchingPresupuestoId}
              esFacturaInternaConvertible={esFacturaInternaConvertible}
            />
          </div>
        </td>
      </tr>
    )
  }

  const renderCardMobile = (p) => {
    // Obtener datos del comprobante
    let comprobanteObj = null
    if (typeof p.comprobante === "object" && p.comprobante !== null) {
      comprobanteObj = p.comprobante
    } else if (p.comprobante) {
      comprobanteObj = (comprobantes || []).find((c) => c.id === p.comprobante) || null
    }

    const comprobanteNombre = comprobanteObj ? comprobanteObj.nombre : ""
    const comprobanteLetra = comprobanteObj ? comprobanteObj.letra : ""
    const comprobanteTipo = comprobanteObj ? comprobanteObj.tipo : ""

    const { icon, label } = getComprobanteIconAndLabel(
      comprobanteTipo,
      comprobanteNombre,
      comprobanteLetra,
    )

    let numeroSinLetra = p.numero_formateado
    if (numeroSinLetra && comprobanteLetra && numeroSinLetra.startsWith(comprobanteLetra + " ")) {
      numeroSinLetra = numeroSinLetra.slice(comprobanteLetra.length + 1)
    }

    const notasCreditoAsociadas = p.notas_credito_que_la_anulan || []
    const facturasAnuladas = p.facturas_anuladas || []
    const tieneNotasCredito = notasCreditoAsociadas.length > 0
    const tieneFacturasAnuladas = facturasAnuladas.length > 0

    return (
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:border-orange-200 transition-colors">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">{icon}</span>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Comprobante</span>
              <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 leading-tight">
                {label}
                {tieneNotasCredito && (
                  <ComprobanteAsociadoTooltip
                    documentos={notasCreditoAsociadas}
                    titulo="Comprobantes Asociados"
                  />
                )}
                {tieneFacturasAnuladas && (
                  <ComprobanteAsociadoTooltip
                    documentos={facturasAnuladas}
                    titulo="Comprobantes Asociados"
                  />
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block">Número</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                {(comprobanteLetra ? comprobanteLetra + " " : "") + (numeroSinLetra || p.numero)}
              </span>
              {p.convertida_a_fiscal && p.factura_fiscal_info && (
                <TooltipFacturado facturaInfo={p.factura_fiscal_info} />
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
          <div>
            <span className="text-slate-500 block font-medium">Fecha</span>
            <p className="text-slate-700">{p.fecha}</p>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Cliente</span>
            <p className="text-slate-700 truncate" title={p.cliente}>{p.cliente}</p>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block leading-none">Total</span>
            <span className="font-bold text-slate-900 text-base">
              ${formatearMoneda(p.total)}
            </span>
          </div>
          <div>
            <ComprobanteAcciones
              comprobante={p}
              acciones={acciones}
              isFetchingForConversion={isFetchingForConversion}
              fetchingPresupuestoId={fetchingPresupuestoId}
              esFacturaInternaConvertible={esFacturaInternaConvertible}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Tabla
      variant="ferredesk"
      columnas={columnas}
      datos={datosPagina}
      renderFila={renderFila}
      renderCardMobile={renderCardMobile}
      mostrarBuscador={false}
      mostrarOrdenamiento={false}
      paginacionControlada={true}
      paginaActual={paginaActual}
      onPageChange={setPaginaActual}
      itemsPerPage={itemsPorPagina}
      onItemsPerPageChange={(n) => {
        setItemsPorPagina(n)
        setPaginaActual(1)
      }}
      opcionesFilasPorPagina={[1, 10, 15, 25, 50]}
      totalRemoto={totalItems}
    />
  )
}

export default ComprobantesList 