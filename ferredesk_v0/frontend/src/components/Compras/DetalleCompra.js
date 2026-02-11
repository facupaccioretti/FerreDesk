"use client"

import { useEffect, useState, useMemo } from "react"
import { IconFactura } from "../ComprobanteIcono"
import { formatearFecha } from "../../utils/formatters"

// Icono de carrito para compras (usado en navbar)
const IconCarrito = ({ className = "w-5 h-5 text-white" }) => (
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
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 0 1 1.5 0Z"
    />
  </svg>
)

// Icono de camión para proveedor (usado en navbar)
const IconCamion = ({ className = "w-5 h-5 text-white" }) => (
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
      d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
    />
  </svg>
)

// Icono de cubo para productos (usado en AsociarCodigoProveedorModal)
const IconCubo = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
  </svg>
)

const formatearMoneda = (valor) => {
  const numero = Number(valor) || 0
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(numero)
}

// Se usa formateador centralizado de ../../utils/formatters

export default function DetalleCompra({ modo = "compra", compra, orden, onClose }) {
  const [detalle, setDetalle] = useState(() => (modo === "compra" ? (compra || null) : (orden || null)))
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  const compraId = compra?.comp_id
  const ordenId = orden?.ord_id

  useEffect(() => {
    const cargarDetalle = async () => {
      const esCompra = modo === "compra"
      const id = esCompra ? compraId : ordenId
      if (!id) return
      setCargando(true)
      setError("")
      try {
        const url = esCompra ? `/api/compras/${id}/` : `/api/ordenes-compra/${id}/`
        const resp = await fetch(url, { credentials: "include" })
        if (!resp.ok) {
          let msg = `Error ${resp.status}`
          try {
            const data = await resp.json()
            msg = data.detail || msg
          } catch { }
          throw new Error(msg)
        }
        const data = await resp.json()
        setDetalle(data)
      } catch (e) {
        setError(e.message || (modo === "compra" ? "No se pudo cargar el detalle de la compra" : "No se pudo cargar el detalle de la orden"))
      } finally {
        setCargando(false)
      }
    }

    cargarDetalle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, compraId, ordenId])

  const items = useMemo(() => (Array.isArray(detalle?.items) ? detalle.items : []), [detalle])

  const esCompra = modo === "compra"
  const titulo = esCompra ? `Detalle de Compra` : `Detalle de Orden de Compra`
  const numero = esCompra
    ? (detalle?.comp_numero_factura || compra?.comp_numero_factura || "-")
    : (detalle?.ord_numero || orden?.ord_numero || "-")
  const fecha = esCompra
    ? (detalle?.comp_fecha || compra?.comp_fecha || null)
    : (detalle?.ord_fecha || orden?.ord_fecha || null)

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg border border-slate-200 relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center">
              <IconCarrito />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{titulo}</h3>
              <div className="text-sm text-slate-300">
                {numero} • {formatearFecha(fecha)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-auto p-6">
          {/* Estado de carga / error */}
          {cargando && (
            <div className="flex items-center gap-3 text-slate-700 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-600 border-t-transparent" />
              <span className="text-sm font-medium">Cargando detalle de la compra...</span>
            </div>
          )}
          {error && (
            <div className="text-red-700 bg-red-50 rounded-lg px-4 py-3 border border-red-200 mb-4">
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Tarjetas informativas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Proveedor */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center">
                  <IconCamion className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Proveedor</h4>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-800">
                  {detalle?.proveedor_nombre || detalle?.comp_razon_social || detalle?.ord_razon_social || "-"}
                </div>
                <div className="text-xs text-slate-600">CUIT: {detalle?.comp_cuit || detalle?.ord_cuit || "-"}</div>
                {(detalle?.comp_domicilio || detalle?.ord_domicilio) && (
                  <div className="text-xs text-slate-600">Domicilio: {detalle?.comp_domicilio || detalle?.ord_domicilio}</div>
                )}
              </div>
            </div>

            {/* Comprobante */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                  <IconFactura className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Comprobante</h4>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-800">{numero}</div>
                <div className="text-xs text-slate-600">Fecha: {formatearFecha(fecha)}</div>
                {detalle?.comp_sucursal && (
                  <div className="text-xs text-slate-600">Sucursal: {detalle.comp_sucursal}</div>
                )}
              </div>
            </div>

            {/* Totales (solo compras) */}
            {esCompra && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">Totales</h4>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Neto</span>
                    <span className="font-medium text-slate-800">{formatearMoneda(detalle?.comp_importe_neto)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">IVA 21%</span>
                    <span className="font-medium text-slate-800">{formatearMoneda(detalle?.comp_iva_21)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">IVA 10.5%</span>
                    <span className="font-medium text-slate-800">{formatearMoneda(detalle?.comp_iva_10_5)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">IVA 27%</span>
                    <span className="font-medium text-slate-800">{formatearMoneda(detalle?.comp_iva_27)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">IVA 0%</span>
                    <span className="font-medium text-slate-800">{formatearMoneda(detalle?.comp_iva_0)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-800">Total</span>
                      <span className="font-bold text-slate-900">{formatearMoneda(detalle?.comp_total_final)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de ítems */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 sticky top-0 z-10">
                  <tr className="text-white border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-medium w-12">#</th>
                    <th className="px-3 py-2 text-left font-medium w-32">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Denominación</th>
                    <th className="px-3 py-2 text-right font-medium w-20">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path
                              fillRule="evenodd"
                              d="M4 5a2 2 0 012-2v1a3 3 0 003 3h2a3 3 0 003-3V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm">Sin ítems registrados</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      if (esCompra) {
                        const cantidad = Number(it.cdi_cantidad) || 0
                        const codigoMostrar = it.codigo_proveedor || ""
                        return (
                          <tr key={it.cdi_orden || idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 font-medium">{it.cdi_orden || idx + 1}</td>
                            <td className="px-3 py-2 text-slate-800 font-mono text-xs">{codigoMostrar}</td>
                            <td className="px-3 py-2 text-slate-800">{it.cdi_detalle1 || ""}</td>
                            <td className="px-3 py-2 text-right text-slate-800 font-medium">{cantidad}</td>
                          </tr>
                        )
                      } else {
                        const cantidad = Number(it.odi_cantidad) || 0
                        const codigoMostrar = it.producto_codigo || ""
                        const denom = it.producto_denominacion || it.odi_detalle1 || ""
                        return (
                          <tr key={it.odi_orden || idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 font-medium">{it.odi_orden || idx + 1}</td>
                            <td className="px-3 py-2 text-slate-800 font-mono text-xs">{codigoMostrar}</td>
                            <td className="px-3 py-2 text-slate-800">{denom}</td>
                            <td className="px-3 py-2 text-right text-slate-800 font-medium">{cantidad}</td>
                          </tr>
                        )
                      }
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
