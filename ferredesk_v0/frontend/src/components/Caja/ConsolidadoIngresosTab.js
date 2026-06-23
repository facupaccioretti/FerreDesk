"use client"

import { useCallback, useEffect, useState } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import { fechaHoyLocal } from "../../utils/fechas"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import Tabla from "../Tabla"

const ConsolidadoIngresosTab = () => {
  const theme = useFerreDeskTheme()
  const { obtenerConsolidadoIngresos } = useCajaAPI()

  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toLocaleDateString("en-CA")
  })
  const [fechaHasta, setFechaHasta] = useState(() => fechaHoyLocal())
  const [cargando, setCargando] = useState(true)
  const [items, setItems] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [lecturaSimple, setLecturaSimple] = useState(null)

  const cargarConsolidado = useCallback(async () => {
    setCargando(true)
    try {
      const resultado = await obtenerConsolidadoIngresos(fechaDesde, fechaHasta)
      setItems(resultado.items || [])
      setMetricas(resultado.metricas || null)
      setLecturaSimple(resultado.lectura_simple || null)
    } catch (error) {
      console.error("Error al cargar consolidado de ingresos:", error)
      setItems([])
      setMetricas(null)
      setLecturaSimple(null)
    } finally {
      setCargando(false)
    }
  }, [fechaDesde, fechaHasta, obtenerConsolidadoIngresos])

  useEffect(() => {
    cargarConsolidado()
  }, [cargarConsolidado])

  const columnas = [
    {
      id: "fecha",
      titulo: "FECHA",
      render: (item) => <span className="text-sm text-slate-700">{formatearFecha(item.fecha, true)}</span>,
    },
    {
      id: "origen",
      titulo: "ORIGEN",
      render: (item) => <span className="text-sm font-medium text-slate-800">{item.origen}</span>,
    },
    {
      id: "medio_pago",
      titulo: "MEDIO",
      render: (item) => <span className="text-sm text-slate-700">{item.medio_pago}</span>,
    },
    {
      id: "monto",
      titulo: "MONTO",
      align: "right",
      render: (item) => (
        <span className="text-sm font-semibold text-slate-800">${formatearMoneda(item.monto)}</span>
      ),
    },
    {
      id: "canal",
      titulo: "CAJA / FUERA",
      render: (item) => {
        const esCaja = item.canal === "CAJA"
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              esCaja ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {esCaja ? "Caja" : "Fuera de caja"}
          </span>
        )
      },
    },
    {
      id: "referencias",
      titulo: "TRAZABILIDAD",
      render: (item) => <span className="text-xs text-slate-600">{item.referencias || "-"}</span>,
    },
  ]

  const renderFila = (item) => (
    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
      {columnas.map((col) => {
        const contenido = col.render ? col.render(item) : item[col.id]
        const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[
          col.align || "left"
        ]
        return (
          <td key={col.id} className={`px-4 py-3 whitespace-nowrap text-sm ${alignClass}`}>
            {contenido}
          </td>
        )
      })}
    </tr>
  )

  const renderCardMobile = (item) => {
    const esCaja = item.canal === "CAJA"
    return (
      <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{formatearFecha(item.fecha, true)}</p>
            <h3 className="text-sm font-semibold text-slate-800">{item.origen}</h3>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
              esCaja ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {esCaja ? "Caja" : "Fuera"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block">Medio</span>
            <span className="font-medium text-slate-700">{item.medio_pago}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Monto</span>
            <span className="font-semibold text-slate-800">${formatearMoneda(item.monto)}</span>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-2">
          <span className="text-slate-500 block text-[11px]">Trazabilidad</span>
          <span className="text-xs text-slate-700">{item.referencias || "-"}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="lg:col-span-2 flex items-end">
            <button
              onClick={cargarConsolidado}
              disabled={cargando}
              className={`${theme.botonPrimario} w-full lg:w-auto`}
            >
              {cargando ? "Cargando..." : "Actualizar consolidado"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total ingresos</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            ${formatearMoneda(metricas?.total_monto || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Por caja</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            ${formatearMoneda(metricas?.total_caja || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fuera de caja</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            ${formatearMoneda(metricas?.total_fuera_caja || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Registros</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{metricas?.total_registros || 0}</p>
        </div>
      </div>

      {lecturaSimple && (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-800">Regla de lectura simple</h3>
          <p className="text-xs text-slate-600">
            Fuentes: {(lecturaSimple.fuentes || []).join(" | ")}
          </p>
          <p className="text-xs text-slate-600">{lecturaSimple.regla_unicidad}</p>
          <p className="text-xs text-slate-600">{lecturaSimple.lectura_caja_fuera_caja}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Tabla
          columnas={columnas}
          datos={items}
          valorBusqueda=""
          onCambioBusqueda={() => {}}
          mostrarBuscador={false}
          mostrarOrdenamiento={false}
          filasPorPaginaInicial={20}
          paginadorVisible={true}
          renderFila={renderFila}
          renderCardMobile={renderCardMobile}
          sinEstilos={true}
          cargando={cargando}
        />
      </div>
    </div>
  )
}

export default ConsolidadoIngresosTab
