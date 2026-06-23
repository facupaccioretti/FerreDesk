"use client"

import { useState, useEffect, useCallback } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { fechaHoyLocal } from "../../utils/fechas"
import Tabla from "../Tabla"

/**
 * Componente que muestra el historial de cajas cerradas.
 * Permite filtrar por fecha, usuario y sucursal.
 * Al hacer clic en una fila, abre un tab con los detalles de esa caja.
 */
const CajasHistorialTable = ({ onCajaClick, onAbrirCaja, tieneCajaAbierta, filtros = {} }) => {
  const theme = useFerreDeskTheme()
  const { obtenerHistorialSesiones } = useCajaAPI()

  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)

  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toLocaleDateString("en-CA")
  })
  const [fechaHasta, setFechaHasta] = useState(() => fechaHoyLocal())
  const [soloMias, setSoloMias] = useState(filtros.solo_mias || false)

  const cargarHistorial = useCallback(async () => {
    setCargando(true)
    try {
      const params = { estado: "CERRADA", solo_mias: soloMias }
      const resultado = await obtenerHistorialSesiones(params)
      if (resultado.results) {
        setCajas(resultado.results)
      } else if (Array.isArray(resultado)) {
        setCajas(resultado)
      } else {
        setCajas([])
      }
    } catch (err) {
      console.error("Error al cargar historial de cajas:", err)
      setCajas([])
    } finally {
      setCargando(false)
    }
  }, [obtenerHistorialSesiones, soloMias])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  const cajasFiltradas = cajas.filter((caja) => {
    if (fechaDesde) {
      const fechaInicio = new Date(caja.fecha_hora_inicio)
      const [y, m, d] = fechaDesde.split("-").map(Number)
      const desde = new Date(y, m - 1, d, 0, 0, 0, 0)
      if (fechaInicio < desde) return false
    }
    if (fechaHasta) {
      const fechaInicio = new Date(caja.fecha_hora_inicio)
      const [y, m, d] = fechaHasta.split("-").map(Number)
      const hasta = new Date(y, m - 1, d, 23, 59, 59, 999)
      if (fechaInicio > hasta) return false
    }
    return true
  })

  const handleClickFila = (caja) => {
    if (onCajaClick) onCajaClick(caja)
  }

  const columnas = [
    {
      id: "fecha_hora_inicio",
      titulo: "APERTURA",
      render: (caja) => (
        <span className="text-xs text-slate-600 tabular-nums">{formatearFecha(caja.fecha_hora_inicio, true)}</span>
      ),
    },
    {
      id: "fecha_hora_fin",
      titulo: "CIERRE",
      render: (caja) => (
        <span className="text-xs text-slate-600 tabular-nums">{formatearFecha(caja.fecha_hora_fin, true)}</span>
      ),
    },
    {
      id: "usuario",
      titulo: "USUARIO",
      render: (caja) => (
        <span className="text-xs text-slate-600">
          {caja.usuario?.username || caja.usuario_nombre || "-"}
        </span>
      ),
    },
    {
      id: "sucursal",
      titulo: "SUCURSAL",
      render: (caja) => <span className="text-xs text-slate-600">{caja.sucursal || "-"}</span>,
    },
    {
      id: "saldo_inicial",
      titulo: "INICIAL",
      align: "right",
      render: (caja) => (
        <span className="text-xs text-right font-medium text-[#1e2d3d] tabular-nums">
          ${formatearMoneda(caja.saldo_inicial)}
        </span>
      ),
    },
    {
      id: "saldo_final_declarado",
      titulo: "FINAL",
      align: "right",
      render: (caja) => (
        <span className="text-xs text-right font-medium text-[#1e2d3d] tabular-nums">
          ${formatearMoneda(caja.saldo_final_declarado)}
        </span>
      ),
    },
    {
      id: "diferencia",
      titulo: "DIF.",
      align: "right",
      render: (caja) => {
        const diferencia = parseFloat(caja.diferencia) || 0
        const colorClass =
          diferencia > 0
            ? "text-[#1e2d3d] font-semibold"
            : diferencia < 0
              ? "text-[#e8641a] font-semibold"
              : "text-slate-400"
        return (
          <span className={`text-xs text-right tabular-nums ${colorClass}`}>
            {diferencia !== 0 ? (diferencia > 0 ? "+" : "") : ""}
            ${formatearMoneda(Math.abs(diferencia))}
          </span>
        )
      },
    },
  ]

  const renderFila = (caja, idxVisible, indiceInicio) => (
    <tr
      key={caja.id}
      onClick={() => handleClickFila(caja)}
      className="hover:bg-slate-50 cursor-pointer transition-colors"
    >
      {columnas.map((col) => {
        const contenido = col.render ? col.render(caja, idxVisible, indiceInicio) : caja[col.id]
        const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[col.align || "left"]
        return (
          <td
            key={col.id}
            className={`px-3 py-2 whitespace-nowrap text-xs ${alignClass}`}
            style={col.ancho ? { width: col.ancho } : undefined}
          >
            {contenido}
          </td>
        )
      })}
    </tr>
  )

  const renderCardMobile = (caja) => {
    const diferencia = parseFloat(caja.diferencia) || 0
    const diferenciaColor =
      diferencia > 0
        ? "text-[#1e2d3d] font-semibold"
        : diferencia < 0
          ? "text-[#e8641a] font-semibold"
          : "text-slate-500 font-medium"

    return (
      <div
        key={caja.id}
        onClick={() => handleClickFila(caja)}
        className="bg-white rounded-lg border border-slate-200 p-3 hover:border-[#1e2d3d]/30 cursor-pointer transition-all mb-2"
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Apertura</span>
            <p className="font-semibold text-[#1e2d3d] text-xs">{formatearFecha(caja.fecha_hora_inicio, true)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2">
          <div>
            <span className="text-slate-400 block">Usuario</span>
            <span className="font-medium text-slate-700">{caja.usuario?.username || caja.usuario_nombre || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Sucursal</span>
            <span className="font-medium text-slate-700">{caja.sucursal || "-"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-100 pt-2 mt-2">
          <div>
            <span className="text-slate-400 block">Inicial</span>
            <span className="font-medium text-[#1e2d3d] tabular-nums">${formatearMoneda(caja.saldo_inicial)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Final</span>
            <span className="font-medium text-[#1e2d3d] tabular-nums">${formatearMoneda(caja.saldo_final_declarado)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Dif.</span>
            <span className={`tabular-nums ${diferenciaColor}`}>
              {diferencia !== 0 ? (diferencia > 0 ? "+" : "") : ""}
              ${formatearMoneda(Math.abs(diferencia))}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Banner no hay caja abierta */}
      {!tieneCajaAbierta && (
        <div className="bg-[#1e2d3d] rounded-lg px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-white">No hay caja abierta</p>
              <p className="text-[10px] text-slate-400">Abra una caja para registrar ventas y movimientos.</p>
            </div>
          </div>
          <button
            onClick={onAbrirCaja}
            className="shrink-0 inline-flex items-center gap-1.5 bg-[#e8641a] hover:bg-[#cf5815] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Abrir Caja
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs text-[#1e2d3d] focus:ring-1 focus:ring-[#e8641a] focus:border-[#e8641a] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs text-[#1e2d3d] focus:ring-1 focus:ring-[#e8641a] focus:border-[#e8641a] outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer pb-0.5">
            <input
              type="checkbox"
              checked={soloMias}
              onChange={(e) => setSoloMias(e.target.checked)}
              className="rounded border-slate-300 text-[#e8641a] focus:ring-[#e8641a]"
            />
            <span className="text-xs text-slate-600">Solo mis cajas</span>
          </label>
          <button
            onClick={cargarHistorial}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 bg-[#1e2d3d] hover:bg-[#162230] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors active:scale-95 disabled:opacity-50"
          >
            {cargando ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Cargando...
              </>
            ) : "Aplicar"}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <Tabla
          columnas={columnas}
          datos={cajasFiltradas}
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

export default CajasHistorialTable
