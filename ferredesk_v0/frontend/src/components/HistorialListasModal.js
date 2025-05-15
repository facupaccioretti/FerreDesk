import React, { useState, useEffect } from 'react';

const HistorialListasModal = ({ open, onClose, proveedor }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && proveedor?.id) {
      setLoading(true);
      setError('');
      fetch(`/api/productos/proveedores/${proveedor.id}/historial-listas/`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => setHistorial(data))
        .catch(() => setError('Error al cargar historial'))
        .finally(() => setLoading(false));
    } else {
      setHistorial([]);
    }
  }, [open, proveedor]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Historial de Listas - {proveedor?.razon}</h2>
        <div className="mb-4">
          {loading ? (
            <div className="text-gray-500">Cargando historial...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1">Fecha</th>
                  <th className="px-2 py-1">Archivo</th>
                  <th className="px-2 py-1">Productos Actualizados</th>
                </tr>
              </thead>
              <tbody>
                {(historial || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">{item.fecha}</td>
                    <td className="px-2 py-1">{item.archivo}</td>
                    <td className="px-2 py-1">{item.productos_actualizados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-red-500 hover:text-white">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default HistorialListasModal; 