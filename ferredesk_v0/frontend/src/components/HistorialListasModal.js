import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from "@headlessui/react";
import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme";

const HistorialListasModal = ({ open, onClose, proveedor }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const theme = useFerreDeskTheme();

  const formatearFecha = (valor) => {
    try {
      const fecha = new Date(valor);
      return fecha.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return valor;
    }
  };

  useEffect(() => {
    if (open && proveedor?.id) {
      setLoading(true);
      setError('');
      fetch(`/api/proveedores/${proveedor.id}/historial-importaciones/`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          const lista = Array.isArray(data) ? data : [];
          const ordenado = lista.slice().sort((a, b) => {
            const fa = new Date(a.fecha).getTime();
            const fb = new Date(b.fecha).getTime();
            return fb - fa; // descendente: más nuevo primero
          });
          setHistorial(ordenado);
        })
        .catch(() => setError('Error al cargar historial'))
        .finally(() => setLoading(false));
    } else {
      setHistorial([]);
    }
  }, [open, proveedor]);

  return (
    <Transition show={open} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
                {/* Encabezado */}
                <div className={`bg-gradient-to-r ${theme.primario} p-6 relative`}>
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-2xl text-slate-300 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                  <Dialog.Title as="h2" className="text-xl font-bold text-white">
                    Historial de Listas - {proveedor?.razon}
                  </Dialog.Title>
                  <p className="text-slate-300 text-sm mt-1">Visualizá las importaciones realizadas para este proveedor</p>
                </div>

                {/* Contenido */}
                <div className="p-6 overflow-y-auto">
                  {loading ? (
                    <div className="text-gray-500">Cargando historial...</div>
                  ) : error ? (
                    <div className="text-red-600">{error}</div>
                  ) : (
                    <table className="min-w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left">Fecha</th>
                          <th className="px-2 py-1 text-left">Archivo</th>
                          <th className="px-2 py-1 text-left">Registros Actualizados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(historial || []).map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-1">{formatearFecha(item.fecha)}</td>
                            <td className="px-2 py-1">{item.archivo}</td>
                            <td className="px-2 py-1">{item.registros_actualizados}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pie */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-white">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default HistorialListasModal; 