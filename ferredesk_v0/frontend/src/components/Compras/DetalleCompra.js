"use client"

import { useEffect, useState, useMemo } from "react"

const formatearMoneda = (valor) => {
  const numero = Number(valor) || 0
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(numero)
}

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return "-"
  try {
    const d = new Date(fechaStr)
    return d.toLocaleDateString("es-AR")
  } catch {
    return fechaStr
  }
}

export default function DetalleCompra({ compra, onClose }) {
  const [detalle, setDetalle] = useState(() => compra || null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  const compraId = compra?.comp_id

  useEffect(() => {
    const cargarDetalle = async () => {
      if (!compraId) return
      setCargando(true)
      setError("")
      try {
        const resp = await fetch(`/api/compras/${compraId}/`, { credentials: "include" })
        if (!resp.ok) {
          let msg = `Error ${resp.status}`
          try {
            const data = await resp.json()
            msg = data.detail || msg
          } catch {}
          throw new Error(msg)
        }
        const data = await resp.json()
        setDetalle(data)
      } catch (e) {
        setError(e.message || "No se pudo cargar el detalle de la compra")
      } finally {
        setCargando(false)
      }
    }

    // Siempre refrezcar desde backend para obtener ítems y totales actualizados
    cargarDetalle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compraId])

  const items = useMemo(() => Array.isArray(detalle?.items) ? detalle.items : [], [detalle])

  const titulo = `Detalle de Compra`;
  const numero = detalle?.comp_numero_factura || compra?.comp_numero_factura || "-"
  const fecha = detalle?.comp_fecha || compra?.comp_fecha || null

  return (
    <div className="px-6 pt-4 pb-6">
      <div className="w-full max-w-[1200px] mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden">
        {/* Contenido interno */}
        <div className="px-8 pt-6 pb-6">
          <div className="max-w-[1100px] mx-auto">
            {/* Header compacto */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 text-white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                    />
                  </svg>
                </div>
                <div className="truncate">
                  <h3 className="text-xl font-semibold text-slate-800 truncate">{titulo}</h3>
                  <div className="text-sm text-slate-600 truncate">{numero} • {formatearFecha(fecha)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Estado de carga / error */}
            {cargando && (
              <div className="flex items-center gap-2 text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 mb-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                Cargando detalle de la compra...
              </div>
            )}
            {error && (
              <div className="text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200 mb-4">{error}</div>
            )}

            {/* Tarjetas informativas compactas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
              {/* Proveedor */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Proveedor</h4>
                <div className="text-sm text-slate-800">{detalle?.proveedor_nombre || detalle?.comp_razon_social || "-"}</div>
                <div className="text-xs text-slate-500">CUIT: {detalle?.comp_cuit || "-"}</div>
                {detalle?.comp_domicilio && (
                  <div className="text-xs text-slate-500 mt-1">Domicilio: {detalle.comp_domicilio}</div>
                )}
              </div>

              {/* Comprobante */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Comprobante</h4>
                <div className="text-sm text-slate-800">{numero}</div>
                <div className="text-xs text-slate-500">Fecha: {formatearFecha(fecha)}</div>
                {detalle?.comp_sucursal && (
                  <div className="text-xs text-slate-500 mt-1">Sucursal: {detalle.comp_sucursal}</div>
                )}
              </div>

              {/* Totales */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Totales</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <div className="text-slate-500">Neto</div>
                  <div className="text-right font-medium">{formatearMoneda(detalle?.comp_importe_neto)}</div>
                  <div className="text-slate-500">IVA 21%</div>
                  <div className="text-right font-medium">{formatearMoneda(detalle?.comp_iva_21)}</div>
                  <div className="text-slate-500">IVA 10.5%</div>
                  <div className="text-right font-medium">{formatearMoneda(detalle?.comp_iva_10_5)}</div>
                  <div className="text-slate-500">IVA 27%</div>
                  <div className="text-right font-medium">{formatearMoneda(detalle?.comp_iva_27)}</div>
                  <div className="text-slate-500">IVA 0%</div>
                  <div className="text-right font-medium">{formatearMoneda(detalle?.comp_iva_0)}</div>
                  <div className="text-slate-700 font-semibold mt-1">Total</div>
                  <div className="text-right font-semibold mt-1">{formatearMoneda(detalle?.comp_total_final)}</div>
                </div>
              </div>
            </div>

            {/* Ítems - Código de proveedor (desde backend), Denominación y Cantidad */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-slate-700">
                      <th className="px-2 py-2 text-left font-semibold w-10">#</th>
                      <th className="px-2 py-2 text-left font-semibold w-40">Código de Proveedor</th>
                      <th className="px-2 py-2 text-left font-semibold">Denominación</th>
                      <th className="px-2 py-2 text-right font-semibold w-24">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500 text-sm">Sin ítems</td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const cantidad = Number(it.cdi_cantidad) || 0
                        const codigoMostrar = it.codigo_proveedor || ''
                        return (
                          <tr key={it.cdi_orden || idx} className="hover:bg-slate-50">
                            <td className="px-2 py-1">{it.cdi_orden || idx + 1}</td>
                            <td className="px-2 py-1">{codigoMostrar}</td>
                            <td className="px-2 py-1">{it.cdi_detalle1 || ''}</td>
                            <td className="px-2 py-1 text-right">{cantidad}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
