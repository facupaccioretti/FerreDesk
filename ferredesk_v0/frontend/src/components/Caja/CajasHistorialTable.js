"use client"

import { useState, useEffect, useCallback } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
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

  // Filtros locales
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [soloMias, setSoloMias] = useState(false)

  // Cargar historial de cajas
  const cargarHistorial = useCallback(async () => {
    setCargando(true)
    try {
      const params = {
        estado: "CERRADA",
        solo_mias: soloMias,
      }

      const resultado = await obtenerHistorialSesiones(params)
      
      // El backend puede retornar paginado o lista simple
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

  // Formatear fecha
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-"
    const fecha = new Date(fechaStr)
    return fecha.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Formatear moneda
  const formatearMoneda = (valor) => {
    const num = parseFloat(valor) || 0
    return num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Filtrar cajas por fechas
  const cajasFiltradas = cajas.filter((caja) => {
    if (fechaDesde) {
      const fechaInicio = new Date(caja.fecha_hora_inicio)
      const desde = new Date(fechaDesde)
      if (fechaInicio < desde) return false
    }
    if (fechaHasta) {
      const fechaInicio = new Date(caja.fecha_hora_inicio)
      const hasta = new Date(fechaHasta)
      hasta.setHours(23, 59, 59, 999) // Incluir todo el día
      if (fechaInicio > hasta) return false
    }
    return true
  })

  const handleClickFila = (caja) => {
    if (onCajaClick) {
      onCajaClick(caja)
    }
  }

  const columnas = [
    {
      id: "fecha_hora_inicio",
      titulo: "FECHA APERTURA",
      render: (caja) => (
        <span className="text-sm text-slate-600">{formatearFecha(caja.fecha_hora_inicio)}</span>
      ),
    },
    {
      id: "fecha_hora_fin",
      titulo: "FECHA CIERRE",
      render: (caja) => (
        <span className="text-sm text-slate-600">{formatearFecha(caja.fecha_hora_fin)}</span>
      ),
    },
    {
      id: "usuario",
      titulo: "USUARIO",
      render: (caja) => (
        <span className="text-sm text-slate-600">
          {caja.usuario?.username || caja.usuario_nombre || "-"}
        </span>
      ),
    },
    {
      id: "sucursal",
      titulo: "SUCURSAL",
      render: (caja) => <span className="text-sm text-slate-600">{caja.sucursal || "-"}</span>,
    },
    {
      id: "saldo_inicial",
      titulo: "SALDO INICIAL",
      align: "right",
      render: (caja) => (
        <span className="text-sm text-right font-medium text-slate-800">
          ${formatearMoneda(caja.saldo_inicial)}
        </span>
      ),
    },
    {
      id: "saldo_final_declarado",
      titulo: "SALDO FINAL",
      align: "right",
      render: (caja) => (
        <span className="text-sm text-right font-medium text-slate-800">
          ${formatearMoneda(caja.saldo_final_declarado)}
        </span>
      ),
    },
    {
      id: "diferencia",
      titulo: "DIFERENCIA",
      align: "right",
      render: (caja) => {
        const diferencia = parseFloat(caja.diferencia) || 0
        const diferenciaColor =
          diferencia > 0
            ? "text-green-600"
            : diferencia < 0
            ? "text-red-600"
            : "text-slate-600"
        return (
          <span className={`text-sm text-right font-semibold ${diferenciaColor}`}>
            {diferencia !== 0 ? (diferencia > 0 ? "+" : "") : ""}
            ${formatearMoneda(Math.abs(diferencia))}
          </span>
        )
      },
    },
  ]

  const renderFila = (caja, idxVisible, indiceInicio) => {
    return (
      <tr
        key={caja.id}
        onClick={() => handleClickFila(caja)}
        className="hover:bg-slate-50 cursor-pointer transition-colors"
      >
        {columnas.map((col) => {
          const contenido = col.render ? col.render(caja, idxVisible, indiceInicio) : caja[col.id]
          const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[
            col.align || "left"
          ]
          return (
            <td
              key={col.id}
              className={`px-4 py-3 whitespace-nowrap text-sm ${alignClass}`}
              style={col.ancho ? { width: col.ancho } : undefined}
            >
              {contenido}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      {/* Botón Abrir Caja si no hay caja abierta */}
      {!tieneCajaAbierta && (
        <div className="bg-white rounded-lg p-6 border border-slate-200 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay caja abierta</h3>
          <p className="text-slate-500 mb-4">
            Para registrar ventas y movimientos, primero debe abrir una caja.
          </p>
          <button
            onClick={onAbrirCaja}
            className={`${theme.botonPrimario} inline-flex items-center gap-2`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Abrir Caja
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={soloMias}
                onChange={(e) => setSoloMias(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-xs text-slate-700">Solo mis cajas</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              onClick={cargarHistorial}
              disabled={cargando}
              className={`${theme.botonPrimario} w-full`}
            >
              {cargando ? "Cargando..." : "Actualizar"}
            </button>
          </div>
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
          sinEstilos={true}
          cargando={cargando}
        />
      </div>
    </div>
  )
}

export default CajasHistorialTable
