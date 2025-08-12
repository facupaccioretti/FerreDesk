import React, { useState, useEffect } from 'react';
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

const opcionesPeriodo = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '1y', label: 'Último año' },
];

const VentasPorDiaSimple = ({ periodo = '7d', onPeriodoChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVentasPorDia();
    // eslint-disable-next-line
  }, [periodo]);

  const fetchVentasPorDia = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodoChange = (nuevoPeriodo) => {
    if (onPeriodoChange) {
      onPeriodoChange(nuevoPeriodo);
    }
  };

  const periodoLabel = opcionesPeriodo.find(op => op.value === periodo)?.label || '';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      },
      title: {
        display: true,
        text: `Evolución de Ventas – ${periodoLabel}`,
        color: '#e2e8f0',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `Ventas: $${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          },
          callback: function(value) {
            return `$${value.toLocaleString()}`;
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

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

  // Título con dropdown inline
  return (
    <div className="container container-type-inline">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-slate-300">Evolución de Ventas –</span>
        <select
          value={periodo}
          onChange={e => handlePeriodoChange(e.target.value)}
          className="text-sm font-semibold text-slate-300 bg-slate-800/70 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
          style={{ minWidth: 100 }}
        >
          {opcionesPeriodo.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>
      <div className="@container h-40 @container/md:h-44 @container/lg:h-52 min-h-[140px] w-full">
        <Line data={data} options={{ ...options, plugins: { ...options.plugins, title: { ...options.plugins.title, display: false } } }} />
      </div>
    </div>
  );
};

export default VentasPorDiaSimple;
