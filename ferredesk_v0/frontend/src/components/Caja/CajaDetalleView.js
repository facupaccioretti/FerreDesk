"use client"

import { useState, useEffect } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { formatearFecha, formatearMoneda } from "../../utils/formatters"
import CajaMovimientos from "./CajaMovimientos"
import ModalObservacionesCaja from "./ModalObservacionesCaja"

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
  const [modalExcedentesVisible, setModalExcedentesVisible] = useState(false)

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

  // Se usan formateadores centralizados de ../../utils/formatters

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
    <div className="space-y-2">
      {/* Línea 1: Header compacto */}
      <div className="flex items-center gap-2 text-xs">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="font-semibold text-slate-700">Caja #{sesion.id}</span>
        <span className="text-slate-400">·</span>
        <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 rounded">Cerrada</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{sesion.usuario_nombre || sesion.usuario?.username || "-"}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{formatearFecha(sesion.fecha_hora_inicio, true)} → {formatearFecha(sesion.fecha_hora_fin, true)}</span>
        {sesion.observaciones_cierre && (
          <>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 italic">{sesion.observaciones_cierre}</span>
          </>
        )}
      </div>

      {/* Línea 2: Saldos en grid compacto */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-50 rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] text-slate-500 leading-tight">Inicial</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">${formatearMoneda(sesion.saldo_inicial)}</p>
        </div>
        <div className="bg-slate-50 rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] text-slate-500 leading-tight">Contado</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">${formatearMoneda(sesion.saldo_final_declarado)}</p>
        </div>
        <div className="bg-slate-50 rounded border border-slate-200 px-2 py-1">
          <p className="text-[10px] text-slate-500 leading-tight">Calculado</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">${formatearMoneda(sesion.saldo_final_sistema)}</p>
        </div>
        <div className={`rounded border px-2 py-1 ${diferencia > 0 ? "bg-green-50 border-green-200" : diferencia < 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          <p className="text-[10px] text-slate-600 leading-tight">Diferencia</p>
          <p className={`text-sm font-bold leading-tight ${diferenciaColor}`}>
            {diferencia !== 0 ? (diferencia > 0 ? "+" : "−") : ""}${formatearMoneda(Math.abs(diferencia))}
          </p>
        </div>
      </div>

      {/* Línea 3: Resumen compacto */}
      {(resumen?.totales_por_metodo?.length > 0 || resumen) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
          {resumen?.totales_por_metodo && resumen.totales_por_metodo.length > 0 && (
            <>
              <span className="text-slate-500 font-medium">Cobros:</span>
              {resumen.totales_por_metodo.map((item, index) => (
                <span key={index}>
                  {item.metodo_pago__nombre} <strong className="text-slate-800">${formatearMoneda(item.total)}</strong>
                </span>
              ))}
              {(parseFloat(resumen?.total_ingresos_manuales) > 0 || parseFloat(resumen?.total_egresos_manuales) > 0) && (
                <span className="text-slate-300">·</span>
              )}
            </>
          )}
          {resumen && (parseFloat(resumen.total_ingresos_manuales) > 0 || parseFloat(resumen.total_egresos_manuales) > 0) && (
            <>
              <span className="text-green-600">
                Ing: <strong>+${formatearMoneda(resumen.total_ingresos_manuales)}</strong>
              </span>
              <span className="text-red-600">
                Eg: <strong>−${formatearMoneda(resumen.total_egresos_manuales)}</strong>
              </span>
            </>
          )}
        </div>
      )}

      {/* Línea 4: Excedentes y Observaciones */}
      {(parseFloat(resumen?.excedente_no_facturado_propina) > 0 ||
        parseFloat(resumen?.vuelto_pendiente) > 0 ||
        resumen?.tramites_con_observaciones?.length > 0) && (
          <div className="bg-amber-50 rounded border border-amber-200 px-2 py-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              {parseFloat(resumen?.excedente_no_facturado_propina) > 0 && (
                <span className="text-amber-700">
                  Excedente: <strong className="text-amber-900">${formatearMoneda(resumen.excedente_no_facturado_propina)}</strong>
                </span>
              )}
              {parseFloat(resumen?.vuelto_pendiente) > 0 && (
                <span className="text-amber-700">
                  Vuelto pend: <strong className="text-amber-900">${formatearMoneda(resumen.vuelto_pendiente)}</strong>
                </span>
              )}
              {/* Botón para ver observaciones/detalles */}
              {(resumen?.tramites_con_observaciones?.length > 0 || resumen?.ventas_con_excedente?.length > 0) && (
                <button
                  onClick={() => setModalExcedentesVisible(true)}
                  className="text-amber-600 hover:text-amber-800 text-[10px] font-bold underline decoration-dotted transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ver {resumen?.tramites_con_observaciones?.length || resumen?.ventas_con_excedente?.length} revisiones
                </button>
              )}
            </div>
          </div>
        )}

      {/* Lista de movimientos (tabla compacta) */}
      <CajaMovimientos movimientos={movimientos} theme={theme} />

      {/* Modal de Observaciones/Excedentes Detallados */}
      {modalExcedentesVisible && (
        <ModalObservacionesCaja
          titulo="Revisiones y Observaciones de Caja"
          tramites={resumen?.tramites_con_observaciones?.length > 0
            ? resumen.tramites_con_observaciones
            : resumen?.ventas_con_excedente?.map(v => ({
              tipo: 'VENTA',
              id: v.id,
              numero: v.numero,
              cliente: v.cliente_nombre || 'Cliente Mostrador',
              monto: v.total || v.monto || v.total_cobrado || 0,
              diferencia: v.excedente,
              observaciones: v.excedente > 0
                ? [`Pago en exceso registrado como ${v.tipo_excedente === 'propina' ? 'propina/redondeo' : 'vuelto'}`]
                : (v.observaciones || [])
            }))
          }
          onCerrar={() => setModalExcedentesVisible(false)}
        />
      )}
    </div>
  )
}

export default CajaDetalleView
