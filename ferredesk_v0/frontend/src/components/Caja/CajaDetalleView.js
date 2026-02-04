"use client"

import { useState, useEffect } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import CajaMovimientos from "./CajaMovimientos"

/**
 * Componente que muestra los detalles completos de una caja cerrada.
 * Vista de solo lectura con información de sesión, resumen de cierre y movimientos.
 */
const CajaDetalleView = ({ sesionId }) => {
  const theme = useFerreDeskTheme()
  const { obtenerResumenCaja, obtenerMovimientos } = useCajaAPI()

  const [sesion, setSesion] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // Cargar detalles de la caja
  useEffect(() => {
    const cargarDetalles = async () => {
      if (!sesionId) return

      setCargando(true)
      setError(null)

      try {
        // Obtener resumen completo de la sesión
        const resultado = await obtenerResumenCaja(sesionId)
        setSesion(resultado.sesion)
        setResumen(resultado.resumen)

        // Obtener movimientos
        const movs = await obtenerMovimientos(sesionId)
        setMovimientos(Array.isArray(movs) ? movs : movs.results || [])
      } catch (err) {
        console.error("Error al cargar detalles de caja:", err)
        setError(err.message || "Error al cargar detalles de la caja")
      } finally {
        setCargando(false)
      }
    }

    cargarDetalles()
  }, [sesionId, obtenerResumenCaja, obtenerMovimientos])

  // Formatear fecha
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-"
    const fecha = new Date(fechaStr)
    return fecha.toLocaleString("es-AR", {
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

  if (cargando) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-600">Cargando detalles de la caja...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-500">No se encontró información de la caja</p>
      </div>
    )
  }

  const diferencia = parseFloat(sesion.diferencia) || 0
  const diferenciaColor =
    diferencia > 0 ? "text-green-600" : diferencia < 0 ? "text-red-600" : "text-slate-600"

  return (
    <div className="space-y-3">
      {/* Línea: Caja cerrada + datos sesión */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          <span className="font-medium text-slate-700">Caja #{sesion.id} · Cerrada</span>
        </div>
        <span className="text-slate-400">|</span>
        <span className="text-slate-500">{sesion.usuario_nombre || sesion.usuario?.username || "-"}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{formatearFecha(sesion.fecha_hora_inicio)} → {formatearFecha(sesion.fecha_hora_fin)}</span>
        {sesion.observaciones_cierre && (
          <>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 italic">{sesion.observaciones_cierre}</span>
          </>
        )}
      </div>

      {/* Línea: números (inicial, contado, calculado, diferencia) */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-slate-500" title="Fondo con el que se abrió la caja">Saldo inicial <strong className="text-slate-700">${formatearMoneda(sesion.saldo_inicial)}</strong></span>
        <span className="text-slate-500" title="Monto que el cajero contó físicamente al cerrar">Contado (físico) <strong className="text-slate-700">${formatearMoneda(sesion.saldo_final_declarado)}</strong></span>
        <span className="text-slate-500" title="Monto que el sistema calcula según registros (ventas, movimientos)">Calculado (sistema) <strong className="text-slate-700">${formatearMoneda(sesion.saldo_final_sistema)}</strong></span>
        <span className={`font-semibold ${diferenciaColor}`} title="Diferencia: positivo = sobrante, negativo = faltante">
          Diferencia {diferencia !== 0 ? (diferencia > 0 ? "+" : "−") : ""}${formatearMoneda(Math.abs(diferencia))}
        </span>
      </div>

      {/* Línea: cobros por método + resumen movimientos */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
        {resumen?.totales_por_metodo && resumen.totales_por_metodo.length > 0 && (
          <>
            <span className="text-slate-400">Cobros:</span>
            {resumen.totales_por_metodo.map((item, index) => (
              <span key={index}>{item.metodo_pago__nombre} <strong className="text-slate-700">${formatearMoneda(item.total)}</strong></span>
            ))}
            <span className="text-slate-300">·</span>
          </>
        )}
        {resumen && (
          <span>
            Ingresos manuales: <strong className="text-green-600">+${formatearMoneda(resumen.total_ingresos_manuales)}</strong>
            {" "} Egresos manuales: <strong className="text-red-600">−${formatearMoneda(resumen.total_egresos_manuales)}</strong>
          </span>
        )}
      </div>

      {/* Excedentes no facturados y vuelto pendiente */}
      {(parseFloat(resumen?.excedente_no_facturado_propina) > 0 || parseFloat(resumen?.vuelto_pendiente) > 0) && (
        <div className="text-xs text-slate-600 space-y-1">
          {parseFloat(resumen?.excedente_no_facturado_propina) > 0 && (
            <p>
              Excedente no facturado (propina/redondeo): <strong className="text-slate-800">${formatearMoneda(resumen.excedente_no_facturado_propina)}</strong>
            </p>
          )}
          {parseFloat(resumen?.vuelto_pendiente) > 0 && (
            <p>
              Vuelto pendiente: <strong className="text-slate-800">${formatearMoneda(resumen.vuelto_pendiente)}</strong>
            </p>
          )}
          {resumen?.ventas_con_excedente?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-slate-500 font-medium mb-1">Detalle por comprobante:</p>
              <ul className="space-y-1">
                {resumen.ventas_con_excedente.map((item, index) => (
                  <li key={index} className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="font-medium text-slate-700">{item.numero}</span>
                    <span className="text-slate-500">
                      {item.excedente_destino === "propina" ? "Propina/redondeo" : "Vuelto pendiente"}
                      {" "}${formatearMoneda(item.vuelto_calculado)}
                    </span>
                    {item.justificacion_excedente && (
                      <span className="text-slate-500 italic" title="Justificación">— {item.justificacion_excedente}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Lista de movimientos (tabla compacta) */}
      <CajaMovimientos movimientos={movimientos} theme={theme} />
    </div>
  )
}

export default CajaDetalleView
