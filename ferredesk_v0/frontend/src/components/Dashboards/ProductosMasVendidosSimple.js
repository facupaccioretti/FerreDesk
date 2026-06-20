import React from "react"

const opcionesMetrica = [
  { value: "cantidad", label: "Cantidad" },
  { value: "total", label: "Facturado" },
]

const truncar = (texto = "", maximo = 34) =>
  texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto

const ProductosMasVendidosSimple = ({
  tipoMetrica = "cantidad",
  onMetricaChange,
  data = [],
  loading = false,
  error = null,
  onRetry,
}) => {
  const maxValue = Math.max(...data.map((item) => Number(item.value || 0)), 0)
  const topLabel = data[0]?.name || "Sin datos"
  const topValue = data[0]?.value || 0

  const formatValue = (value) =>
    tipoMetrica === "cantidad"
      ? `${Number(value).toLocaleString("es-AR")} u.`
      : `$${Number(value).toLocaleString("es-AR")}`

  if (loading) {
    return (
      <div className="flex h-[190px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
          <p className="text-xs text-slate-400">Cargando productos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[190px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-300">No se pudieron cargar los productos.</p>
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
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top productos</p>
          <p className="truncate text-lg font-bold leading-tight text-slate-100">{truncar(topLabel, 42)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatValue(topValue)} vendidos</p>
        </div>
        <select
          value={tipoMetrica}
          onChange={(e) => onMetricaChange?.(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          {opcionesMetrica.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {data.slice(0, 5).map((item, index) => {
          const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 0
          return (
            <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_84px] items-center gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-slate-200">
                    <span className="mr-1 text-slate-500">{index + 1}.</span>
                    {truncar(item.name, 34)}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-900/80">
                  <div
                    className="h-2 rounded-full bg-orange-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-slate-300">{formatValue(item.value)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ProductosMasVendidosSimple
