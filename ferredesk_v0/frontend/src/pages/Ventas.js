import React, { useState, useEffect } from 'react';
import VentasTable from '../components/VentasTable';
import VentaForm from '../components/VentaForm';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Ventas = () => {
  const [ventas, setVentas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchVentas = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/ventas/');
      setVentas(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar las ventas: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, []);

  const handleEdit = (venta) => {
    setSelectedVenta(venta);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/ventas/${id}/`);
      await fetchVentas();
      setError(null);
    } catch (err) {
      setError('Error al eliminar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleConvertirAVenta = async (presupuesto) => {
    try {
      const response = await axios.post(`/api/ventas/${presupuesto.id}/convertir-a-venta/`);
      await fetchVentas();
      setError(null);
      // Opcional: Redirigir a la venta creada
      navigate(`/ventas/${response.data.id}`);
    } catch (err) {
      setError('Error al convertir a venta: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleConvertirAFactura = async (documento) => {
    try {
      const response = await axios.post(`/api/ventas/${documento.id}/convertir-a-factura/`);
      await fetchVentas();
      setError(null);
      // Opcional: Redirigir a la factura creada
      navigate(`/facturas/${response.data.id}`);
    } catch (err) {
      setError('Error al convertir a factura: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleImprimir = async (venta) => {
    try {
      const response = await axios.get(`/api/ventas/${venta.id}/imprimir/`, {
        responseType: 'blob'
      });
      
      // Crear URL del blob y abrir en nueva pestaña
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url);
    } catch (err) {
      setError('Error al imprimir: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleVer = (venta) => {
    setSelectedVenta(venta);
    setShowForm(true);
  };

  const handleSave = async (ventaData, items) => {
    try {
      if (selectedVenta) {
        await axios.put(`/api/ventas/${selectedVenta.id}/`, { ...ventaData, items });
      } else {
        await axios.post('/api/ventas/', { ...ventaData, items });
      }
      setShowForm(false);
      setSelectedVenta(null);
      await fetchVentas();
      setError(null);
    } catch (err) {
      setError('Error al guardar: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando...</div>;
  }

  if (showForm) {
    return (
      <VentaForm
        initialData={selectedVenta}
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false);
          setSelectedVenta(null);
        }}
        readOnlyOverride={selectedVenta?.estado === 'Cerrado'}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ventas y Presupuestos</h1>
        <button
          onClick={() => {
            setSelectedVenta(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Nuevo Presupuesto
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          {error}
        </div>
      )}

      <VentasTable
        ventas={ventas}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onConvertirAVenta={handleConvertirAVenta}
        onConvertirAFactura={handleConvertirAFactura}
        onImprimir={handleImprimir}
        onVer={handleVer}
      />
    </div>
  );
};

export default Ventas; 