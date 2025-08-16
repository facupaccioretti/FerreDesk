import React from "react";
import { useEffect, useState, useCallback } from "react"
import Navbar from "./Navbar"
import ProductosMasVendidosSimple from "./Dashboards/ProductosMasVendidosSimple"
import VentasPorDiaSimple from "./Dashboards/VentasPorDiaSimple"
import ClientesMasVentasSimple from "./Dashboards/ClientesMasVentasSimple"

const MetricCard = ({ title, value, icon, color }) => (
  <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-md border border-slate-800 ring-1 ring-orange-500/20 p-2 flex items-center space-x-2">
    <div className={`p-1 rounded-md ${color} bg-opacity-20`}>
      {React.cloneElement(icon, { className: icon.props.className.replace('w-4 h-4', 'w-3 h-3') })}
    </div>
    <div>
      <p className="text-xs font-medium text-slate-400">{title}</p>
      <p className="text-sm font-bold text-slate-300">{value}</p>
    </div>
  </div>
);

// Hook personalizado para obtener métricas reactivas
const useMetricData = (periodoVentas, metricaClientes, metricaProductos) => {
  const [metrics, setMetrics] = useState({
    totalVentas: 'Cargando...',
    clienteMasVentas: 'Cargando...',
    promedioVentas: 'Cargando...',
    productoMasVendido: 'Cargando...',
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        // Fetch Total de Ventas (basado en el período seleccionado)
        const ventasResponse = await fetch(`/api/home/ventas-por-dia/?periodo=${periodoVentas}`, { 
          credentials: 'include' 
        });
        const ventasData = await ventasResponse.json();
        let totalVentas = 'N/A';
        if (ventasData?.datasets?.[0]?.data) {
          const ventas = ventasData.datasets[0].data;
          totalVentas = `$${ventas.reduce((sum, venta) => sum + venta, 0).toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`;
        }

        // Fetch Cliente #1 (basado en la métrica seleccionada)
        const clientResponse = await fetch(`/api/home/clientes-mas-ventas/?tipo=${metricaClientes}`, { 
          credentials: 'include' 
        });
        const clientData = await clientResponse.json();
        const topClient = clientData?.labels?.[0] || 'N/A';

        // Fetch Promedio de Ventas (basado en el período seleccionado)
        let promedioVentas = 'N/A';
        if (ventasData?.datasets?.[0]?.data) {
          const ventas = ventasData.datasets[0].data;
          const total = ventas.reduce((sum, venta) => sum + venta, 0);
          promedioVentas = `$${(total / ventas.length).toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`;
        }

        // Fetch Producto más vendido (reactivo a metricaProductos)
        const prodResponse = await fetch(`/api/home/productos-mas-vendidos/?tipo=${metricaProductos}`, { credentials: 'include' });
        const prodData = await prodResponse.json();
        const topProduct = prodData?.labels?.[0] || 'N/A';
        
        setMetrics({ totalVentas, clienteMasVentas: topClient, promedioVentas, productoMasVendido: topProduct });
      } catch (error) {
        setMetrics({ totalVentas: 'Error', clienteMasVentas: 'Error', promedioVentas: 'Error', productoMasVendido: 'Error' });
      } finally {
        setLoadingMetrics(false);
      }
    };
    fetchMetrics();
  }, [periodoVentas, metricaClientes, metricaProductos]);

  return { metrics, loadingMetrics };
};

const Home = () => {
  const [user, setUser] = useState(null)
  // Estado para los filtros de los gráficos
  const [periodoVentas, setPeriodoVentas] = useState('7d');
  const [metricaClientes, setMetricaClientes] = useState('total');
  const [metricaProductos, setMetricaProductos] = useState('cantidad');

  // Obtener métricas reactivas
  const { metrics, loadingMetrics } = useMetricData(periodoVentas, metricaClientes, metricaProductos);

  // Iconos para las tarjetas de métricas
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
  };

  useEffect(() => { document.title = "Panel Principal FerreDesk" }, [])
  useEffect(() => { fetch("/api/user/", { credentials: "include" }).then((res) => res.json()).then((data) => { if (data.status === "success") setUser(data.user) }) }, [])
  const handleLogout = useCallback(() => { setUser(null); window.location.href = "/login" }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`, backgroundSize: "20px 20px" }}></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>
      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="container mx-auto px-8 py-2">
          {/* Primera fila: Panel Principal y métricas centradas */}
          <div className="flex flex-col items-center mb-3">
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Panel Principal</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard title="Total (Ventas)" value={loadingMetrics ? 'Cargando...' : metrics.totalVentas} icon={metricIcons.total} color="bg-green-100" />
              <MetricCard title="Cliente #1" value={loadingMetrics ? 'Cargando...' : metrics.clienteMasVentas} icon={metricIcons.cliente} color="bg-blue-100" />
              <MetricCard title="Promedio de Ventas" value={loadingMetrics ? 'Cargando...' : metrics.promedioVentas} icon={metricIcons.promedio} color="bg-purple-100" />
              <MetricCard title="Producto #1" value={loadingMetrics ? 'Cargando...' : metrics.productoMasVendido} icon={metricIcons.producto} color="bg-orange-100" />
            </div>
          </div>
          {/* Segunda fila: dos gráficos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-lg border border-slate-800 ring-1 ring-orange-500/20 p-3">
              <ProductosMasVendidosSimple tipoMetrica={metricaProductos} onMetricaChange={setMetricaProductos} />
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-lg border border-slate-800 ring-1 ring-orange-500/20 p-3">
              <ClientesMasVentasSimple tipoMetrica={metricaClientes} onMetricaChange={setMetricaClientes} />
            </div>
          </div>
          {/* Tercera fila: gráfico de evolución de ventas */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg shadow-lg border border-slate-800 ring-1 ring-orange-500/20 p-3">
            <VentasPorDiaSimple periodo={periodoVentas} onPeriodoChange={setPeriodoVentas} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
