"use client"

import { useMemo } from "react"

/**
 * Componente que muestra la lista de movimientos manuales de caja.
 */
const CajaMovimientos = ({ movimientos, theme }) => {
  const formatFechaHora = (fechaStr) => {
    if (!fechaStr) return "-"
    const fecha = new Date(fechaStr)
    return fecha.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatMoney = (value) => {
    const num = parseFloat(value) || 0
    return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const movimientosOrdenados = useMemo(() => {
    if (!Array.isArray(movimientos)) return []
    return [...movimientos].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
  }, [movimientos])

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
        Movimientos Manuales
      </h3>

      {movimientosOrdenados.length === 0 ? (
        <div className="text-center py-4 text-slate-400 text-xs border border-slate-100 rounded-lg bg-white">
          Sin movimientos en esta sesión
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1e2d3d]">
                <th className="px-3 py-1.5 text-left font-semibold text-slate-300 text-[10px] uppercase tracking-wider">
                  Fecha/Hora
                </th>
                <th className="px-3 py-1.5 text-left font-semibold text-slate-300 text-[10px] uppercase tracking-wider w-20">
                  Tipo
                </th>
                <th className="px-3 py-1.5 text-left font-semibold text-slate-300 text-[10px] uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-3 py-1.5 text-right font-semibold text-slate-300 text-[10px] uppercase tracking-wider">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientosOrdenados.map((mov, idx) => {
                const esEntrada = mov.tipo === "ENTRADA"
                return (
                  <tr
                    key={mov.id}
                    className={`transition-colors hover:bg-slate-50 ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                  >
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap tabular-nums">
                      {formatFechaHora(mov.fecha_hora)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${
                          esEntrada
                            ? "bg-[#1e2d3d] text-white"
                            : "border border-[#e8641a] text-[#e8641a]"
                        }`}
                      >
                        {esEntrada ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td
                      className="px-3 py-1.5 text-slate-600 truncate max-w-[200px]"
                      title={mov.descripcion}
                    >
                      {mov.descripcion}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-semibold tabular-nums ${
                        esEntrada ? "text-[#1e2d3d]" : "text-[#e8641a]"
                      }`}
                    >
                      {esEntrada ? "+" : "−"}${formatMoney(mov.monto)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CajaMovimientos
