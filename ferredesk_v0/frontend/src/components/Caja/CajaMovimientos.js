"use client"

import { useMemo } from "react"

/**
 * Componente que muestra la lista de movimientos manuales de caja.
 */
const CajaMovimientos = ({ movimientos, theme }) => {
    // Formatear fecha y hora
    const formatFechaHora = (fechaStr) => {
        if (!fechaStr) return '-'
        const fecha = new Date(fechaStr)
        return fecha.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Formatear moneda
    const formatMoney = (value) => {
        const num = parseFloat(value) || 0
        return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    // Ordenar movimientos por fecha (más recientes primero)
    const movimientosOrdenados = useMemo(() => {
        if (!Array.isArray(movimientos)) return []
        return [...movimientos].sort((a, b) =>
            new Date(b.fecha_hora) - new Date(a.fecha_hora)
        )
    }, [movimientos])

    return (
        <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-1">
                Movimientos Manuales
            </h3>

            {movimientosOrdenados.length === 0 ? (
                <div className="text-center py-3 text-slate-400 text-xs">
                    No hay movimientos en esta sesión
                </div>
            ) : (
                <div className="overflow-hidden rounded border border-slate-200">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="px-2 py-1 text-left font-medium text-slate-500">Fecha/Hora</th>
                                <th className="px-2 py-1 text-left font-medium text-slate-500 w-16">Tipo</th>
                                <th className="px-2 py-1 text-left font-medium text-slate-500">Descripción</th>
                                <th className="px-2 py-1 text-right font-medium text-slate-500">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {movimientosOrdenados.map((mov) => (
                                <tr key={mov.id} className="hover:bg-slate-50/50">
                                    <td className="px-2 py-0.5 text-slate-500 whitespace-nowrap">{formatFechaHora(mov.fecha_hora)}</td>
                                    <td className="px-2 py-0.5">
                                        <span className={mov.tipo === 'ENTRADA' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                            {mov.tipo === 'ENTRADA' ? 'Ingreso' : 'Egreso'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-0.5 text-slate-600 truncate max-w-[200px]" title={mov.descripcion}>{mov.descripcion}</td>
                                    <td className={`px-2 py-0.5 text-right font-medium tabular-nums ${mov.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}`}>
                                        {mov.tipo === 'ENTRADA' ? '+' : '−'}${formatMoney(mov.monto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default CajaMovimientos
