"use client"

import { useMemo } from "react"

/**
 * Estado actual de la caja: saldo, cobros por método, movimientos, teórico.
 */
const CajaEstado = ({ sesion, resumen, theme, onVerObservaciones }) => {
    // Formatear fecha y hora
    const fechaApertura = useMemo(() => {
        if (!sesion?.fecha_hora_inicio) return '-'
        const fecha = new Date(sesion.fecha_hora_inicio)
        return fecha.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }, [sesion?.fecha_hora_inicio])

    const formatMoney = (value) => {
        const num = parseFloat(value) || 0
        return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const saldoInicial = parseFloat(resumen?.saldo_inicial ?? sesion?.saldo_inicial) || 0
    const teorico = parseFloat(resumen?.saldo_teorico_efectivo) || 0
    const ingresos = parseFloat(resumen?.total_ingresos_manuales) || 0
    const egresos = parseFloat(resumen?.total_egresos_manuales) || 0
    const mismoSaldoYTeorico = saldoInicial === teorico
    const sinMovimientos = ingresos === 0 && egresos === 0
    const hayVentas = (resumen?.cantidad_ventas ?? 0) > 0 || (parseFloat(resumen?.total_ventas) || 0) > 0
    const cobrosConMonto = resumen?.totales_por_metodo?.filter((item) => parseFloat(item.total) > 0) || []
    const cantidadObs = parseInt(resumen?.cantidad_observaciones) || 0

    if (!sesion) return null

    return (
        <div className="mb-3 relative">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-slate-600">Caja Abierta</span>
                    <span className="text-xs text-slate-400">· {fechaApertura}</span>
                </div>
                {/* Botón de Notificación de Observaciones */}
                {cantidadObs > 0 && (
                    <button
                        onClick={onVerObservaciones}
                        className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                        title="Ver observaciones pendientes"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{cantidadObs} Obs.</span>
                    </button>
                )}
                <span className="text-xs text-slate-400">|</span>
                {mismoSaldoYTeorico ? (
                    <span className="text-xs font-semibold text-slate-800">Teórico <strong>${formatMoney(teorico)}</strong></span>
                ) : (
                    <>
                        <span className="text-xs text-slate-500">Saldo inicial <strong className="text-slate-700">${formatMoney(saldoInicial)}</strong></span>
                        <span className="text-xs font-semibold text-slate-800">Teórico <strong>${formatMoney(teorico)}</strong></span>
                    </>
                )}
                {sinMovimientos ? (
                    <span className="text-xs text-slate-500">Mov. manuales $0</span>
                ) : (
                    <>
                        <span className="text-xs text-green-600">+Ingresos ${formatMoney(resumen?.total_ingresos_manuales)}</span>
                        <span className="text-xs text-red-600">−Egresos ${formatMoney(resumen?.total_egresos_manuales)}</span>
                    </>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {cobrosConMonto.length > 0 && (
                    <>
                        <span className="text-slate-400">Cobros:</span>
                        {cobrosConMonto.map((item, index) => (
                            <span key={index}>{item.metodo_pago__nombre} <strong className="text-slate-700">${formatMoney(item.total)}</strong></span>
                        ))}
                        <span className="text-slate-300">·</span>
                    </>
                )}
                {hayVentas && resumen?.cantidad_ventas !== undefined && (
                    <span>Comprobantes: {resumen.cantidad_ventas} — Total <strong>${formatMoney(resumen.total_ventas)}</strong></span>
                )}
                {(parseFloat(resumen?.excedente_no_facturado_propina) > 0 || parseFloat(resumen?.vuelto_pendiente) > 0) && (
                    <>
                        <span className="text-slate-300">·</span>
                        {parseFloat(resumen?.excedente_no_facturado_propina) > 0 && (
                            <span>Propina/red.: <strong className="text-slate-700">${formatMoney(resumen.excedente_no_facturado_propina)}</strong></span>
                        )}
                        {parseFloat(resumen?.vuelto_pendiente) > 0 && (
                            <span>Vuelto pend.: <strong className="text-slate-700">${formatMoney(resumen.vuelto_pendiente)}</strong></span>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default CajaEstado
