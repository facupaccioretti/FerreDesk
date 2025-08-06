import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProductosMasVendidos = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tipoMetrica, setTipoMetrica] = useState('cantidad'); // 'cantidad' o 'total'

  useEffect(() => {
    fetchProductosMasVendidos();
  }, [tipoMetrica]);

  const fetchProductosMasVendidos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/home/productos-mas-vendidos/?tipo=${tipoMetrica}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
      // Datos de ejemplo para desarrollo
      setData({
        labels: ['Tornillos 3x20', 'Cable Eléctrico 2.5mm', 'Pintura Blanca 20L', 'Cemento 50kg', 'Clavos 2"', 'Cinta Aisladora', 'Destornillador Phillips', 'Martillo 500g', 'Escalera 6 escalones', 'Brocha 2"'],
        datasets: [{
          label: tipoMetrica === 'cantidad' ? 'Cantidad Vendida' : 'Total Facturado ($)',
          data: tipoMetrica === 'cantidad' 
            ? [1250, 980, 750, 650, 520, 480, 420, 380, 320, 280]
            : [125000, 98000, 75000, 65000, 52000, 48000, 42000, 38000, 32000, 28000],
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      });
    } finally {
      setLoading(false);
    }
  };

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
        text: `Top 10 Productos Más Vendidos - ${tipoMetrica === 'cantidad' ? 'Por Cantidad' : 'Por Total Facturado'}`,
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
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (tipoMetrica === 'cantidad') {
              return `${label}: ${value.toLocaleString()} unidades`;
            } else {
              return `${label}: $${value.toLocaleString()}`;
            }
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
          },
          maxRotation: 45,
          minRotation: 45
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
          callback: function(value) {
            if (tipoMetrica === 'cantidad') {
              return value.toLocaleString();
            } else {
              return `$${value.toLocaleString()}`;
            }
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            onClick={fetchProductosMasVendidos}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <h3 className="@container text-base @container/md:text-lg @container/lg:text-xl font-bold text-slate-800">Productos Más Vendidos</h3>
          <p className="@container text-xs @container/md:text-sm text-slate-600">Análisis de los productos con mayor demanda</p>
        </div>
        
        {/* Selector de métrica */}
        <div className="flex items-center space-x-2">
          <span className="@container text-xs @container/md:text-sm font-medium text-slate-700">Métrica:</span>
          <select
            value={tipoMetrica}
            onChange={(e) => setTipoMetrica(e.target.value)}
            className="@container px-2 @container/md:px-3 py-1 border border-slate-300 rounded-lg @container text-xs @container/md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="cantidad">Por Cantidad</option>
            <option value="total">Por Total Facturado</option>
          </select>
        </div>
      </div>

      {/* Gráfico */}
      <div className="@container h-48 @container/md:h-56 @container/lg:h-64 min-h-[200px] w-full">
        <Bar data={data} options={options} />
      </div>

      {/* Información adicional */}
      <div className="@container mt-4 @container/md:mt-6 grid grid-cols-1 sm:grid-cols-3 @container gap-2 @container/md:gap-4">
        <div className="bg-blue-50 rounded-lg @container p-2 @container/md:p-4">
          <div className="flex items-center">
            <div className="@container p-1 @container/md:p-2 bg-blue-100 rounded-lg">
              <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="@container ml-2 @container/md:ml-3">
              <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Producto #1</p>
              <p className="@container text-sm @container/md:text-lg font-bold text-slate-800 truncate">
                {data?.labels[0] || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg @container p-2 @container/md:p-4">
          <div className="flex items-center">
            <div className="@container p-1 @container/md:p-2 bg-green-100 rounded-lg">
              <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="@container ml-2 @container/md:ml-3">
              <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Total Vendido</p>
              <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                {tipoMetrica === 'cantidad' 
                  ? `${data?.datasets[0]?.data[0]?.toLocaleString() || 0} unidades`
                  : `$${data?.datasets[0]?.data[0]?.toLocaleString() || 0}`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg @container p-2 @container/md:p-4">
          <div className="flex items-center">
            <div className="@container p-1 @container/md:p-2 bg-purple-100 rounded-lg">
              <svg className="@container w-4 h-4 @container/md:w-5 @container/md:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="@container ml-2 @container/md:ml-3">
              <p className="@container text-xs @container/md:text-sm font-medium text-slate-600">Participación</p>
              <p className="@container text-sm @container/md:text-lg font-bold text-slate-800">
                {data?.datasets[0]?.data[0] && data?.datasets[0]?.data[9] 
                  ? `${((data.datasets[0].data[0] / data.datasets[0].data[0]) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductosMasVendidos; 