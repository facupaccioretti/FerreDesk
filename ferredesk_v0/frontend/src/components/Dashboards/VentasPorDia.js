import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const VentasPorDia = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('7d'); // '7d', '30d', '90d', '1y'

  const fetchVentasPorDia = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/home/ventas-por-dia/?periodo=${periodo}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchVentasPorDia();
  }, [fetchVentasPorDia]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#1e293b',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      title: {
        display: true,
        text: `Evolución de Ventas - Últimos ${periodo === '7d' ? '7 días' : periodo === '30d' ? '30 días' : periodo === '90d' ? '90 días' : '1 año'}`,
        color: '#1e293b',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function (context) {
            return `Ventas: $${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          },
          callback: function (value) {
            return `$${value.toLocaleString()}`;
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  const calcularEstadisticas = () => {
    if (!data?.datasets[0]?.data) return null;

    const ventas = data.datasets[0].data;
    const total = ventas.reduce((sum, venta) => sum + venta, 0);
    const promedio = total / ventas.length;
    const maximo = Math.max(...ventas);
    const minimo = Math.min(...ventas);
    const tendencia = ventas[ventas.length - 1] - ventas[0];

    return {
      total,
      promedio,
      maximo,
      minimo,
      tendencia
    };
  };

  const stats = calcularEstadisticas();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-slate-600">Error: {error}</p>
          <button
            onClick={fetchVentasPorDia}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 lg:p-6 container container-type-inline">
      {/* Header con controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0 mb-4 lg:mb-6">
        <div>
          <h3 className="@container text-base @container/md:text-lg @container/lg:text-xl font-bold text-slate-800">Evolución de Ventas</h3>
          <p className="@container text-xs @container/md:text-sm text-slate-600">Análisis temporal de las ventas diarias</p>
        </div>

        {/* Selector de período */}
        <div className="flex items-center space-x-2">
          <span className="@container text-xs @container/md:text-sm font-medium text-slate-700">Período:</span>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="@container px-2 @container/md:px-3 py-1 border border-slate-300 rounded-lg @container text-xs @container/md:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="1y">Último año</option>
          </select>
        </div>
      </div>

      {/* Gráfico */}
      <div className="@container h-48 @container/md:h-56 @container/lg:h-64 min-h-[200px] w-full">
        <Line data={data} options={options} />
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="@container mt-4 @container/md:mt-6 grid grid-cols-2 lg:grid-cols-5 @container gap-2 @container/md:gap-4">
          <div className="bg-green-50 rounded-lg @container p-2 @container/md:p-4">
            <div className="flex items-center">
              <div className="@container p-1 @container/md:p-2 bg-green-100 rounded-lg">
                <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="@container ml-2 @container/md:ml-3">
                <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Total</p>
                <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                  ${stats.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg @container p-2 @container/md:p-4">
            <div className="flex items-center">
              <div className="@container p-1 @container/md:p-2 bg-blue-100 rounded-lg">
                <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="@container ml-2 @container/md:ml-3">
                <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Promedio</p>
                <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                  ${stats.promedio.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-lg @container p-2 @container/md:p-4">
            <div className="flex items-center">
              <div className="@container p-1 @container/md:p-2 bg-emerald-100 rounded-lg">
                <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="@container ml-2 @container/md:ml-3">
                <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Máximo</p>
                <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                  ${stats.maximo.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg @container p-2 @container/md:p-4">
            <div className="flex items-center">
              <div className="@container p-1 @container/md:p-2 bg-orange-100 rounded-lg">
                <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div className="@container ml-2 @container/md:ml-3">
                <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Mínimo</p>
                <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                  ${stats.minimo.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg @container p-2 @container/md:p-4">
            <div className="flex items-center">
              <div className="@container p-1 @container/md:p-2 bg-purple-100 rounded-lg">
                <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="@container ml-2 @container/md:ml-3">
                <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Tendencia</p>
                <p className={`@container text-sm @container/md:text-lg font-bold ${stats.tendencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.tendencia >= 0 ? '+' : ''}${stats.tendencia.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasPorDia; 