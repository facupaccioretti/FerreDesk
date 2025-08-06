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

const ClientesMasVentas = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tipoMetrica, setTipoMetrica] = useState('total'); // 'total', 'cantidad', 'frecuencia'

  useEffect(() => {
    fetchClientesMasVentas();
  }, [tipoMetrica]);

  const fetchClientesMasVentas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/clientes-mas-ventas/?tipo=${tipoMetrica}`, {
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
      const clientes = [
        'Constructora ABC S.A.',
        'Ferretería Central',
        'Obras Públicas Municipal',
        'Empresa XYZ Ltda.',
        'Distribuidora Norte',
        'Constructora Sur',
        'Ferretería del Este',
        'Empresa Constructora',
        'Distribuidora Oeste',
        'Constructora Nacional'
      ];
      
      const valores = tipoMetrica === 'total' 
        ? [450000, 380000, 320000, 280000, 250000, 220000, 190000, 170000, 150000, 130000]
        : tipoMetrica === 'cantidad'
        ? [45, 38, 32, 28, 25, 22, 19, 17, 15, 13]
        : [12, 10, 8, 7, 6, 5, 4, 3, 3, 2];
      
      setData({
        labels: clientes,
        datasets: [{
          label: tipoMetrica === 'total' ? 'Total Facturado ($)' : tipoMetrica === 'cantidad' ? 'Cantidad de Productos' : 'Frecuencia de Compras',
          data: valores,
          backgroundColor: 'rgba(168, 85, 247, 0.8)',
          borderColor: 'rgba(168, 85, 247, 1)',
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
    indexAxis: 'y', // Gráfico horizontal
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
        text: `Top 10 Clientes - ${tipoMetrica === 'total' ? 'Por Total Facturado' : tipoMetrica === 'cantidad' ? 'Por Cantidad de Productos' : 'Por Frecuencia de Compras'}`,
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
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.x;
            if (tipoMetrica === 'total') {
              return `${label}: $${value.toLocaleString()}`;
            } else if (tipoMetrica === 'cantidad') {
              return `${label}: ${value.toLocaleString()} productos`;
            } else {
              return `${label}: ${value.toLocaleString()} compras`;
            }
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          },
          callback: function(value) {
            if (tipoMetrica === 'total') {
              return `$${value.toLocaleString()}`;
            } else {
              return value.toLocaleString();
            }
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#64748b',
          font: {
            size: 11
          },
          maxRotation: 0,
          minRotation: 0
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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
            onClick={fetchClientesMasVentas}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
      {/* Header con controles */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Clientes con Más Ventas</h3>
          <p className="text-slate-600 text-sm">Análisis de los clientes más importantes</p>
        </div>
        
        {/* Selector de métrica */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-slate-700">Métrica:</span>
          <select
            value={tipoMetrica}
            onChange={(e) => setTipoMetrica(e.target.value)}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="total">Por Total Facturado</option>
            <option value="cantidad">Por Cantidad de Productos</option>
            <option value="frecuencia">Por Frecuencia de Compras</option>
          </select>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-96">
        <Bar data={data} options={options} />
      </div>

      {/* Información adicional */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Cliente #1</p>
              <p className="text-lg font-bold text-slate-800">
                {data?.labels[0] || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Valor</p>
              <p className="text-lg font-bold text-slate-800">
                {tipoMetrica === 'total' 
                  ? `$${data?.datasets[0]?.data[0]?.toLocaleString() || 0}`
                  : `${data?.datasets[0]?.data[0]?.toLocaleString() || 0} ${tipoMetrica === 'cantidad' ? 'productos' : 'compras'}`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Participación</p>
              <p className="text-lg font-bold text-slate-800">
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

export default ClientesMasVentas; 