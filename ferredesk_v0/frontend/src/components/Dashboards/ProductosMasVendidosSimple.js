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

const opcionesMetrica = [
  { value: 'cantidad', label: 'Por Cantidad' },
  { value: 'total', label: 'Por Total Facturado' },
];

const ProductosMasVendidosSimple = ({ tipoMetrica = 'cantidad', onMetricaChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProductosMasVendidos();
    // eslint-disable-next-line
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
      // Limitar a top 5
      if (result && result.labels && result.datasets && result.datasets[0] && result.datasets[0].data) {
        result.labels = result.labels.slice(0, 5);
        result.datasets[0].data = result.datasets[0].data.slice(0, 5);
      }
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMetricaChange = (nuevaMetrica) => {
    if (onMetricaChange) {
      onMetricaChange(nuevaMetrica);
    }
  };

  const metricaLabel = opcionesMetrica.find(op => op.value === tipoMetrica)?.label || '';

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
        text: `Productos Más Vendidos – ${metricaLabel}`,
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
            const value = context.parsed.x;
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

  // Título con dropdown inline
  return (
    <div className="container container-type-inline">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-slate-800">Productos Más Vendidos –</span>
        <select
          value={tipoMetrica}
          onChange={e => handleMetricaChange(e.target.value)}
          className="text-sm font-semibold text-slate-800 bg-transparent border border-slate-300 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
          style={{ minWidth: 100 }}
        >
          {opcionesMetrica.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>
      <div className="@container h-40 @container/md:h-44 @container/lg:h-52 min-h-[140px] w-full">
        <Bar data={data} options={{ ...options, plugins: { ...options.plugins, title: { ...options.plugins.title, display: false } } }} />
      </div>
    </div>
  );
};

export default ProductosMasVendidosSimple;
