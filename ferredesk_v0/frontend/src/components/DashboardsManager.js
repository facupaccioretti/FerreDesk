import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import ProductosMasVendidos from './Dashboards/ProductosMasVendidos';
import VentasPorDia from './Dashboards/VentasPorDia';
import ClientesMasVentas from './Dashboards/ClientesMasVentas';

const DashboardsManager = () => {
  const navigate = useNavigate();
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.title = "Dashboards FerreDesk"
  }, []);

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setUser(data.user)
      })
  }, []);

  // Tipos de dashboards disponibles
  const dashboardTypes = [
    {
      id: 'productos-mas-vendidos',
      label: 'Productos Más Vendidos',
      description: 'Análisis de los productos con mayor demanda',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
      ),
      iconColor: "text-blue-700",
      gradient: "from-blue-50 to-blue-100/60",
      borderColor: "border-blue-300/50",
      hoverGradient: "hover:from-blue-100 hover:to-blue-200/60",
      component: ProductosMasVendidos
    },
    {
      id: 'ventas-por-dia',
      label: 'Evolución de Ventas',
      description: 'Análisis temporal de las ventas diarias',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      iconColor: "text-emerald-700",
      gradient: "from-emerald-50 to-emerald-100/60",
      borderColor: "border-emerald-300/50",
      hoverGradient: "hover:from-emerald-100 hover:to-emerald-200/60",
      component: VentasPorDia
    },
    {
      id: 'clientes-mas-ventas',
      label: 'Clientes con Más Ventas',
      description: 'Análisis de los clientes más importantes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      iconColor: "text-purple-700",
      gradient: "from-purple-50 to-purple-100/60",
      borderColor: "border-purple-300/50",
      hoverGradient: "hover:from-purple-100 hover:to-purple-200/60",
      component: ClientesMasVentas
    },
    {
      id: 'financiero',
      label: 'Dashboard Financiero',
      description: 'Métricas financieras, rentabilidad y análisis de costos',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.375c0 .621-.504 1.125-1.125 1.125H3.375c-.621 0-1.125-.504-1.125-1.125V5.25m18 0v12.75a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V5.25m18 0v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v2.625" />
        </svg>
      ),
      iconColor: "text-green-700",
      gradient: "from-green-50 to-green-100/60",
      borderColor: "border-green-300/50",
      hoverGradient: "hover:from-green-100 hover:to-green-200/60"
    },
    {
      id: 'operaciones',
      label: 'Dashboard de Operaciones',
      description: 'Eficiencia operativa, tiempos de entrega y productividad',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      iconColor: "text-orange-700",
      gradient: "from-orange-50 to-orange-100/60",
      borderColor: "border-orange-300/50",
      hoverGradient: "hover:from-orange-100 hover:to-orange-200/60"
    },
    {
      id: 'general',
      label: 'Dashboard General',
      description: 'Vista general de todos los indicadores principales del negocio',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      iconColor: "text-cyan-700",
      gradient: "from-cyan-50 to-cyan-100/60",
      borderColor: "border-cyan-300/50",
      hoverGradient: "hover:from-cyan-100 hover:to-cyan-200/60"
    }
  ];

  const handleDashboardSelect = useCallback((dashboard) => {
    setSelectedDashboard(dashboard);
    console.log('Dashboard seleccionado:', dashboard);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null)
    window.location.href = "/login"
  }, []);

  // Componente de tarjeta individual
  const TarjetaDashboard = React.memo(function TarjetaDashboard({ card, onClick }) {
    return (
      <div
        className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-xl rounded-2xl overflow-hidden border ${card.borderColor} bg-gradient-to-br ${card.gradient} ${card.hoverGradient}`}
        onClick={() => onClick(card)}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`${card.iconColor} p-3 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg`}>
              {card.icon}
            </div>
            {selectedDashboard?.id === card.id && (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-slate-900 transition-colors duration-300">
            {card.label}
          </h3>
          
          <p className="text-slate-600 text-sm leading-relaxed mb-4 group-hover:text-slate-700 transition-colors duration-300">
            {card.description}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors duration-300 flex items-center">
              Ver Dashboard
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1 text-orange-600"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    )
  });

  // Memoizo la lista de tarjetas para que no se regenere en cada render
  const tarjetasUI = useMemo(
    () => dashboardTypes.map((card) => <TarjetaDashboard key={card.id} card={card} onClick={handleDashboardSelect} />),
    [handleDashboardSelect],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      {/* Patrón de textura sutil */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Gradiente adicional para profundidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <div className="relative z-10">
        <Navbar user={user} onLogout={handleLogout} />

        <div className="container mx-auto px-6 py-8">
          <h2 className="text-3xl font-extrabold text-slate-800 text-center mb-8 drop-shadow-sm">Dashboards</h2>

          <div className="flex flex-col md:flex-row">
            {/* Main content - Cards */}
            <div className="flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">{tarjetasUI}</div>
            </div>
          </div>

          {/* Área de Dashboard Seleccionado */}
          {selectedDashboard && (
            <div className="mt-8 max-w-7xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-800">
                      {selectedDashboard.label}
                    </h2>
                    <p className="text-slate-600">
                      {selectedDashboard.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDashboard(null)}
                    className="text-slate-500 hover:text-slate-700 transition-colors duration-200 p-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Renderizar el componente del dashboard si existe */}
                {selectedDashboard.component ? (
                  <selectedDashboard.component />
                ) : (
                  <div className="bg-slate-50 rounded-xl p-8 text-center">
                    <div className={`${selectedDashboard.iconColor} mb-4`}>
                      {selectedDashboard.icon}
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-2">
                      Dashboard en Desarrollo
                    </h3>
                    <p className="text-slate-600">
                      El dashboard "{selectedDashboard.label}" está siendo desarrollado. 
                      Aquí se mostrarán los indicadores y métricas correspondientes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardsManager; 