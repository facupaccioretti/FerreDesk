import React from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"

const opcionesPeriodo = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "1y", label: "1 año" },
]

const formatearMonedaCorta = (valor) => {
  const numero = Number(valor || 0)
  if (numero >= 1000000) return `$${(numero / 1000000).toFixed(1)}M`
  if (numero >= 1000) return `$${Math.round(numero / 1000)}k`
  return `$${numero.toLocaleString("es-AR")}`
}

const VentasPorDiaSimple = ({
  periodo = "7d",
  onPeriodoChange,
  data = [],
  loading = false,
  error = null,
  onRetry,
}) => {
  const totalVentas = data.reduce((acc, item) => acc + Number(item.value || 0), 0)
  const promedioVentas = data.length > 0 ? totalVentas / data.length : 0

  if (loading) {
    return (
      <div className="flex h-[210px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-400">Cargando ventas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[210px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-300">No se pudo cargar la evolución de ventas.</p>
          <button
            onClick={onRetry}
            className="mt-3 rounded-md border border-orange-500 bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Evolución de ventas</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[2rem] font-black leading-none text-slate-100">
              ${totalVentas.toLocaleString("es-AR")}
            </p>
            <p className="text-xs text-slate-400">
              Promedio {formatearMonedaCorta(promedioVentas)}
            </p>
          </div>
        </div>

        <div className="flex rounded-md border border-slate-600 bg-slate-800/80 p-1">
          {opcionesPeriodo.map((op) => (
            <button
              key={op.value}
              onClick={() => onPeriodoChange?.(op.value)}
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                periodo === op.value
                  ? "bg-orange-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[155px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#334155" vertical={false} strokeOpacity={0.55} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={formatearMonedaCorta}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                borderRadius: 8,
                color: "#e2e8f0",
              }}
              formatter={(value) => [`$${Number(value).toLocaleString("es-AR")}`, "Ventas"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#fb923c" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default VentasPorDiaSimple
