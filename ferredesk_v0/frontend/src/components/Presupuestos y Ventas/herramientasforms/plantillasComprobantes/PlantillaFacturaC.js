// PlantillaFacturaC.js
// Componente visual para mostrar el detalle de una Factura C, Presupuesto o Venta

//linea 30

import { formatearDescuentosVisual, formatearMoneda, mapearTipoComprobante } from "./helpers"
import Tabla from "../../../Tabla"
import { useFerreDeskTheme } from "../../../../hooks/useFerreDeskTheme"
import { Dialog, Transition } from "@headlessui/react"
import { Fragment } from "react"

// Constante para controlar cuándo la tabla empieza a scrollear
const CANTIDAD_ITEMS_PARA_SCROLL_TABLA = 7

// Icono de cliente (usado en navbar)
const IconCliente = ({ className = "w-5 h-5 text-white" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
)

const PlantillaFacturaC = ({ data, ferreteriaConfig, onClose }) => {
  const tema = useFerreDeskTheme()
  
  // Determinar si la tabla debe tener scroll específico
  const items = data.items || []
  const debeTenerScrollTabla = items.length > CANTIDAD_ITEMS_PARA_SCROLL_TABLA

  // Extraemos información del comprobante de manera flexible
  const letraComprobante = data?.comprobante?.letra ?? data?.comprobante_letra ?? data?.letra ?? "C"
  const codigoAfip = data?.comprobante?.codigo_afip ?? data?.comprobante_codigo_afip ?? "11"

  return (
    <Transition show={true} as={Fragment}>
      <Dialog
        onClose={onClose}
        className="relative z-50"
      >
        {/* Overlay con animación */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>

        {/* Contenedor del modal con animación */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-6xl bg-white rounded-lg shadow-lg border border-slate-200 relative overflow-hidden max-h-[95vh] flex flex-col">
              {/* Header */}
              <div className="bg-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{letraComprobante}</span>
                  </div>
                  <div>
                                         <h3 className={`text-lg font-semibold ${tema.fuente}`}>
                       {mapearTipoComprobante(data.comprobante)} {letraComprobante}
                     </h3>
                    <div className={`text-sm ${tema.fuenteSecundaria}`}>
                      {data.numero_formateado || "0000-00000001"} • {data.fecha || ""}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={`${tema.botonSecundario} text-sm font-medium`}
                >
                  Cerrar
                </button>
              </div>

              {/* Contenido de la página - con scroll general del modal */}
              <div className="flex-1 overflow-auto p-6">
                {/* Tarjetas informativas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  {/* Cliente */}
                  <div className={`${tema.tarjetaClara} rounded-lg border border-slate-200 p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        <IconCliente className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">Cliente</h4>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-800">
                        {data.cliente || "Cliente"}
                      </div>
                      <div className="text-xs text-slate-600">{data.domicilio || ""}</div>
                      <div className="text-xs text-slate-600">{data.localidad || ""}</div>
                      <div className="text-xs text-slate-600">{data.provincia || ""}</div>
                      <div className="text-xs text-slate-600">DNI/CUIT: {data.cuit || "-"}</div>
                      <div className="text-xs text-slate-600">Cond. IVA: {data.condicion_iva_cliente || "-"}</div>
                      <div className="text-xs text-slate-600">Teléfono: {data.telefono_cliente || "-"}</div>
                      <div className="text-xs text-slate-600">Cond. Venta: Contado</div>
                    </div>
                  </div>

                  {/* Comprobante */}
                  <div className={`${tema.tarjetaClara} rounded-lg border border-slate-200 p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center">
                        <span className="text-orange-600 font-semibold text-sm">{letraComprobante}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">Comprobante</h4>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-800">{data.numero_formateado || "0000-00000001"}</div>
                      <div className="text-xs text-slate-600">Fecha: {data.fecha || ""}</div>
                      <div className="text-xs text-slate-600">Hora: {data.hora_creacion ? data.hora_creacion.split('.')[0] : "No disponible"}</div>
                      <div className="text-xs text-slate-600">Cód. AFIP: {codigoAfip}</div>
                                             <div className="text-xs text-slate-600">Tipo: {mapearTipoComprobante(data.comprobante)}</div>
                    </div>
                  </div>

                  {/* Emisor */}
                  <div className={`${tema.tarjetaClara} rounded-lg border border-slate-200 p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                        <span className="text-slate-600 font-semibold text-sm">E</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">Emisor</h4>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-800">
                        {ferreteriaConfig?.nombre || "Nombre de la Empresa"}
                      </div>
                      <div className="text-xs text-slate-600">{ferreteriaConfig?.direccion || ""}</div>
                      <div className="text-xs text-slate-600">CUIT: {ferreteriaConfig?.cuit_cuil || "-"}</div>
                      <div className="text-xs text-slate-600">Cond. IVA: {ferreteriaConfig?.situacion_iva || "-"}</div>
                      <div className="text-xs text-slate-600">Teléfono: {ferreteriaConfig?.telefono || "-"}</div>
                      <div className="text-xs text-slate-600">Ing. Brutos: {ferreteriaConfig?.ingresos_brutos || "-"}</div>
                      <div className="text-xs text-slate-600">Inicio Act.: {ferreteriaConfig?.inicio_actividad || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Tabla de ítems - con scroll específico cuando es necesario */}
                <div className="mb-4">
                  <div className={debeTenerScrollTabla ? "max-h-72 overflow-auto border border-slate-200 rounded-lg" : ""}>
                    <Tabla
                      columnas={[
                        { id: "codigo", titulo: "Código", align: "left", ancho: "60px" },
                        { id: "descripcion", titulo: "Descripción", align: "left", ancho: "150px" },
                        { id: "cantidad", titulo: "Cantidad", align: "right", ancho: "50px" },
                        { id: "precio", titulo: "P. Unitario", align: "right", ancho: "80px" },
                        { id: "descuento", titulo: "Desc. %", align: "center", ancho: "60px" },
                        { id: "precioBonificado", titulo: "P. Unit. Bonif.", align: "right", ancho: "80px" },
                        { id: "importe", titulo: "Importe", align: "right", ancho: "100px" }
                      ]}
                      datos={items.map((item, idx) => ({
                        id: idx,
                        codigo: item.codigo ?? "-",
                        descripcion: item.vdi_detalle1 ?? "-",
                        cantidad: item.vdi_cantidad ?? 0,
                        precio: `$${formatearMoneda(item.vdi_precio_unitario_final || 0)}`,
                        descuento: formatearDescuentosVisual(item.vdi_bonifica, data.ven_descu1, data.ven_descu2, data.ven_descu3),
                        precioBonificado: `$${formatearMoneda(item.precio_unitario_bonificado_con_iva || 0)}`,
                        importe: `$${formatearMoneda(item.total_item || 0)}`
                      }))}
                      paginadorVisible={false}
                      mostrarBuscador={false}
                      mostrarOrdenamiento={false}
                      sinEstilos={true}
                      tamañoEncabezado="pequeño"
                      renderFila={(fila, idx) => (
                        <tr key={fila.id} className="hover:bg-slate-50">
                          <td className="px-2 py-1 text-slate-800 font-mono text-xs">{fila.codigo}</td>
                          <td className="px-2 py-1 text-slate-800 text-xs">{fila.descripcion}</td>
                          <td className="px-2 py-1 text-right text-slate-800 font-medium text-xs">{fila.cantidad}</td>
                          <td className="px-2 py-1 text-right text-slate-800 font-medium text-xs">{fila.precio}</td>
                          <td className="px-2 py-1 text-center text-orange-600 font-medium text-xs">{fila.descuento}</td>
                          <td className="px-2 py-1 text-right text-slate-800 font-medium text-xs">{fila.precioBonificado}</td>
                          <td className="px-2 py-1 text-right text-slate-900 font-bold text-xs">{fila.importe}</td>
                        </tr>
                      )}
                    />
                  </div>
                </div>

                {/* Totales - Replicando exactamente la configuración del PDF */}
                <div className={`${tema.tarjetaClara} rounded-lg border border-slate-200 p-3 mb-4`}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-slate-600 mb-1">Subtotal</div>
                      <div className="text-xs font-bold text-slate-900">${formatearMoneda(data.ven_total || 0)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-600 mb-1">Total</div>
                      <div className="text-sm font-black text-emerald-700">
                        ${formatearMoneda(data.ven_total || data.total || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información AFIP simplificada */}
                <div className={`${tema.tarjetaClara} rounded-lg border border-slate-200 p-3`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-600">CAE:</span>
                      <span className="font-mono text-slate-900">{data.ven_cae || data.cae || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-600">Vencimiento CAE:</span>
                      <span className="font-mono text-slate-900">{data.ven_caevencimiento || data.cae_vencimiento || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default PlantillaFacturaC
export { PlantillaFacturaC } 