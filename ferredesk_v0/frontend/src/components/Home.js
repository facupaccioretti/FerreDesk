import React from "react"
import { useEffect, useState, useCallback } from "react"
import Navbar from "./Navbar"
import ProductosMasVendidosSimple from "./Dashboards/ProductosMasVendidosSimple"
import VentasPorDiaSimple from "./Dashboards/VentasPorDiaSimple"
import ClientesMasVentasSimple from "./Dashboards/ClientesMasVentasSimple"
import { useLogoutMutation } from "../domains/session/useLogoutMutation"
import { useSessionUserQuery } from "../domains/session/useSessionUserQuery"
import { useDashboardMetrics } from "../hooks/useDashboardMetrics"
import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme"

const MetricCard = ({ title, value, icon, iconBg }) => (
  <div className="flex min-h-[72px] items-center gap-2.5 rounded-lg border border-slate-800 bg-gradient-to-br from-slate-800 to-slate-700 px-3 py-2 shadow-sm ring-1 ring-orange-500/15">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-600 ${iconBg}`}>
      {React.cloneElement(icon, {
        className: icon.props.className.replace("w-4 h-4", "w-4 h-4"),
      })}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="truncate text-[1.05rem] font-bold leading-tight text-slate-100">{value}</p>
    </div>
  </div>
)

const Home = () => {
  const tema = useFerreDeskTheme()
  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()
  const [periodoVentas, setPeriodoVentas] = useState("7d")
  const [metricaClientes, setMetricaClientes] = useState("total")
  const [metricaProductos, setMetricaProductos] = useState("cantidad")

  const { metrics, loadingMetrics, charts, queries } = useDashboardMetrics({
    periodoVentas,
    metricaClientes,
    metricaProductos,
  })

  const metricIcons = {
    total: (
      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    cliente: (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    promedio: (
      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    producto: (
      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  }

  useEffect(() => {
    document.title = "Panel Principal FerreDesk"
  }, [])

  const handleLogout = useCallback(() => {
    logout().finally(() => {
      window.location.href = "/login/"
    })
  }, [logout])

  const fechaActual = new Date().toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className={tema.fondo}>
      <div
        className={tema.patron}
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div className={tema.overlay} />

      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        <div className="mx-auto max-w-[1280px] px-4 py-3 lg:px-5">
          <div className="mb-2">
            <p className="text-xs font-medium text-slate-500">{fechaActual}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <MetricCard title="Ventas" value={loadingMetrics ? "Cargando..." : metrics.totalVentas} icon={metricIcons.total} iconBg="bg-green-50" />
            <MetricCard title="Cliente destacado" value={loadingMetrics ? "Cargando..." : metrics.clienteMasVentas} icon={metricIcons.cliente} iconBg="bg-blue-50" />
            <MetricCard title="Promedio" value={loadingMetrics ? "Cargando..." : metrics.promedioVentas} icon={metricIcons.promedio} iconBg="bg-purple-50" />
            <MetricCard title="Producto líder" value={loadingMetrics ? "Cargando..." : metrics.productoMasVendido} icon={metricIcons.producto} iconBg="bg-orange-50" />
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 xl:grid-cols-[1fr_1fr]">
            <div className={tema.contenedorDashboard}>
              <ProductosMasVendidosSimple
                tipoMetrica={metricaProductos}
                onMetricaChange={setMetricaProductos}
                data={charts.productosMasVendidos}
                loading={queries.productos.isLoading}
                error={queries.productos.error}
                onRetry={() => queries.productos.refetch()}
              />
            </div>
            <div className={tema.contenedorDashboard}>
              <ClientesMasVentasSimple
                tipoMetrica={metricaClientes}
                onMetricaChange={setMetricaClientes}
                data={charts.clientesMasVentas}
                loading={queries.clientes.isLoading}
                error={queries.clientes.error}
                onRetry={() => queries.clientes.refetch()}
              />
            </div>
          </div>

          <div className={`mt-2.5 ${tema.contenedorDashboard}`}>
            <VentasPorDiaSimple
              periodo={periodoVentas}
              onPeriodoChange={setPeriodoVentas}
              data={charts.ventasPorDia}
              loading={queries.ventas.isLoading}
              error={queries.ventas.error}
              onRetry={() => queries.ventas.refetch()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
