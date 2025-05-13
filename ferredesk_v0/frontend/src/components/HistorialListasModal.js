import React, { useState } from 'react';

const HistorialListasModal = ({ open, onClose, proveedor, historial }) => {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const handleExpand = (idx) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Historial de Listas - {proveedor?.razon}</h2>
        <div className="mb-4">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1">Fecha</th>
                <th className="px-2 py-1">Archivo</th>
                <th className="px-2 py-1">Usuario</th>
                <th className="px-2 py-1">Productos Actualizados</th>
                <th className="px-2 py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(historial || []).map((item, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">{item.fecha}</td>
                  <td className="px-2 py-1">{item.archivo}</td>
                  <td className="px-2 py-1">{item.usuario}</td>
                  <td className="px-2 py-1">{item.productosActualizados}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => handleExpand(idx)}
                      className={`flex items-center justify-center w-6 h-6 text-gray-700 transition-transform duration-200 ${expandedIdx === idx ? 'rotate-90' : 'rotate-0'}`}
                      aria-label={expandedIdx === idx ? 'Ocultar detalles' : 'Mostrar detalles'}
                      style={{ padding: 0 }}
                      title={expandedIdx === idx ? 'Ocultar detalles' : 'Mostrar detalles'}
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                        <polygon points="5,3 15,10 5,17" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-red-500 hover:text-white">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default HistorialListasModal; 