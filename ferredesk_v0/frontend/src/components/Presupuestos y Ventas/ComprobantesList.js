import React from "react"
import { IconVenta, IconFactura, IconCredito, IconPresupuesto, IconRecibo } from "../ComprobanteIcono"
import { BotonEditar, BotonEliminar, BotonGenerarPDF, BotonConvertir, BotonVerDetalle, BotonNotaCredito } from "../Botones"
import ComprobanteAsociadoTooltip from "./herramientasforms/ComprobanteAsociadoTooltip"
import TooltipFacturado from "./herramientasforms/TooltipFacturado"
import AccionesMenu from "./herramientasforms/AccionesMenu"
import { formatearMoneda } from "./herramientasforms/plantillasComprobantes/helpers"
import Paginador from "../Paginador"

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
 * 
 * @param {Object} props - Props del componente
 * @param {Array} props.comprobantes - Lista de comprobantes a mostrar
 * @param {Array} props.datosPagina - Datos paginados para mostrar
 * @param {Object} props.acciones - Funciones de acciones disponibles
 * @param {boolean} props.isFetchingForConversion - Estado de carga para conversión
 * @param {number} props.fetchingPresupuestoId - ID del presupuesto siendo convertido
 * @param {Function} props.esFacturaInternaConvertible - Función para verificar si es factura interna convertible
 * @param {number} props.totalItems - Total de items
 * @param {number} props.itemsPorPagina - Items por página
 * @param {number} props.paginaActual - Página actual
 * @param {Function} props.setPaginaActual - Función para cambiar página
 * @param {Function} props.setItemsPorPagina - Función para cambiar items por página
 * @returns {JSX.Element} - Tabla de comprobantes con paginación
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
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full divide-y divide-slate-200" style={{ minWidth: "1200px", tableLayout: "fixed" }}>
          <thead className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600">
            <tr>
              <th className="px-3 py-3 text-left text-sm font-semibold text-slate-100" style={{ width: "22%" }}>
                Comprobante
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-slate-100" style={{ width: "32%" }}>
                N°
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-slate-100" style={{ width: "14%" }}>
                Fecha
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-slate-100" style={{ width: "18%" }}>
                Cliente
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold text-slate-100" style={{ width: "14%" }}>
                Total
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold text-slate-100" style={{ width: "50px" }}>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-300 leading-tight">
            {datosPagina.map((p) => {
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
                      {/* Renderizar tooltip si hay notas de crédito asociadas a la factura */}
                      {tieneNotasCredito && (
                        <ComprobanteAsociadoTooltip
                          documentos={notasCreditoAsociadas}
                          titulo="Comprobantes Asociados"
                        />
                      )}
                      {/* Renderizar tooltip si la NC anula facturas */}
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
            })}
          </tbody>
        </table>
      </div>

      {/* Paginador */}
      <Paginador
        totalItems={totalItems}
        itemsPerPage={itemsPorPagina}
        currentPage={paginaActual}
        onPageChange={setPaginaActual}
        onItemsPerPageChange={(n) => {
          setItemsPorPagina(n)
          setPaginaActual(1)
        }}
        opcionesItemsPorPagina={[1, 10, 15, 25, 50]}
      />
    </>
  )
}

export default ComprobantesList 