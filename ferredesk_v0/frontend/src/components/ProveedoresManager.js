import React, { useEffect, useState } from 'react';
import Navbar from "./Navbar";
import ListaPreciosModal from "./ListaPreciosModal";
import HistorialListasModal from "./HistorialListasModal";
import ProveedorForm from "./ProveedorForm";
import { useProveedoresAPI } from '../utils/useProveedoresAPI';

const mockHistorial = [
  { fecha: '2024-06-01', archivo: 'macons_junio.xlsx', usuario: 'ferreadmin', productosActualizados: 120 },
  { fecha: '2024-05-01', archivo: 'macons_mayo.xlsx', usuario: 'ferreadmin', productosActualizados: 110 },
];

const ProveedoresManager = () => {
  // Hook API real
  const {
    proveedores, addProveedor, updateProveedor, deleteProveedor, loading, error
  } = useProveedoresAPI();

  // Estados para búsqueda y UI
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [tabs, setTabs] = useState([
    { key: 'lista', label: 'Lista de Proveedores', closable: false }
  ]);
  const [activeTab, setActiveTab] = useState('lista');
  const [editProveedor, setEditProveedor] = useState(null);
  const [formError, setFormError] = useState(null);

  // Modales
  const [showListaModal, setShowListaModal] = React.useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = React.useState(null);
  const [showHistorialModal, setShowHistorialModal] = React.useState(false);
  const [proveedorHistorial, setProveedorHistorial] = React.useState(null);

  useEffect(() => {
    document.title = "Proveedores FerreDesk";
  }, []);

  // Tabs y edición
  const openTab = (key, label, proveedor = null) => {
    setEditProveedor(proveedor);
    setFormError(null);
    setTabs(prev => {
      if (prev.find(t => t.key === key)) return prev;
      return [...prev, { key, label, closable: true }];
    });
    setActiveTab(key);
  };
  const closeTab = (key) => {
    setTabs(prev => prev.filter(t => t.key !== key));
    if (activeTab === key) setActiveTab('lista');
    setEditProveedor(null);
    setFormError(null);
  };

  // Guardar proveedor (alta o edición)
  const handleSaveProveedor = async (data) => {
    setFormError(null);
    try {
      if (editProveedor) {
        await updateProveedor(editProveedor.id, data);
      } else {
        await addProveedor(data);
      }
      closeTab('nuevo');
    } catch (err) {
      setFormError(err.message || 'Error al guardar el proveedor');
    }
  };

  const handleEditProveedor = (prov) => {
    openTab('nuevo', 'Editar Proveedor', prov);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este proveedor?')) {
      try {
        await deleteProveedor(id);
      } catch (err) {
        alert(err.message || 'Error al eliminar proveedor');
      }
    }
  };

  // Filtro de búsqueda
  const proveedoresFiltrados = proveedores.filter(p =>
    (p.razon || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.fantasia || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.cuit || '').toLowerCase().includes(search.toLowerCase())
  );

  // Modales
  const handleOpenListaModal = (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setShowListaModal(true);
  };
  const handleImportLista = (info) => {
    alert(`Lista importada para ${info.proveedor.razon}\n${info.message || ''}\nRegistros procesados: ${info.registrosProcesados ?? 'N/D'}`);
  };
  const handleOpenHistorialModal = (proveedor) => {
    setProveedorHistorial(proveedor);
    setShowHistorialModal(true);
  };

  return (
    <div className="h-full flex flex-col">
      <Navbar user={{ username: "ferreadmin" }} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Proveedores</h2>
      </div>
      <div className="flex flex-1 px-6 gap-4 min-h-0">
        <div className="flex-1 flex flex-col">
          {/* Tabs tipo browser */}
          <div className="flex items-center border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
            {tabs.map(tab => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-2 mr-2 rounded-t-xl cursor-pointer transition-colors ${activeTab === tab.key ? 'bg-white border border-b-0 border-gray-200 font-semibold text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: 'relative' }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={e => { e.stopPropagation(); closeTab(tab.key); }}
                    className="ml-2 text-lg font-bold text-gray-400 hover:text-red-400 focus:outline-none"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {/* Botón Nuevo Proveedor solo en la tab de lista */}
            {activeTab === 'lista' && (
              <div className="flex-1 flex justify-end mb-2">
                <button
                  onClick={() => openTab('nuevo', 'Nuevo Proveedor')}
                  className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                >
                  <span className="text-lg">+</span> Nuevo Proveedor
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-sm min-h-0 p-6">
            {activeTab === 'lista' && (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    className="pl-4 pr-4 py-2 w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Buscar proveedor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {loading && <div className="text-gray-500 mb-2">Cargando proveedores...</div>}
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <div className="overflow-auto rounded-xl shadow bg-white">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-white border-b">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">RAZÓN SOCIAL</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">FANTASIA</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">DOMICILIO</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">TELÉFONO</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">CUIT</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">SIGLA</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {proveedoresFiltrados.map(p => (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                              <div className="flex items-center">
                                <button
                                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                  className={`flex items-center justify-center w-6 h-6 mr-2 text-gray-700 transition-transform duration-200 ${expandedId === p.id ? 'rotate-90' : 'rotate-0'}`}
                                  aria-label={expandedId === p.id ? 'Ocultar detalles' : 'Mostrar detalles'}
                                  style={{ padding: 0 }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                                    <polygon points="5,3 15,10 5,17" />
                                  </svg>
                                </button>
                                <span>{p.razon}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.fantasia}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.domicilio}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.tel1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.cuit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.sigla}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-2 items-center">
                                <button
                                  onClick={() => handleEditProveedor(p)}
                                  title="Editar"
                                  className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  title="Eliminar"
                                  className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleOpenListaModal(p)}
                                  title="Cargar Lista"
                                  className="transition-colors px-1 py-1 text-green-600 hover:text-green-800"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleOpenHistorialModal(p)}
                                  title="Historial"
                                  className="transition-colors px-1 py-1 text-gray-800 hover:text-black"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                    <path d="M3 3v5h5"></path>
                                    <path d="M12 7v5l4 2"></path>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedId === p.id && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                  <div>
                                    <span className="block text-gray-400 font-medium">Razón Social</span>
                                    <span className="block text-gray-700 mt-1">{p.razon}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-medium">Nombre de Fantasía</span>
                                    <span className="block text-gray-700 mt-1">{p.fantasia}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-medium">Domicilio</span>
                                    <span className="block text-gray-700 mt-1">{p.domicilio}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-medium">Teléfono</span>
                                    <span className="block text-gray-700 mt-1">{p.tel1}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-medium">CUIT</span>
                                    <span className="block text-gray-700 mt-1">{p.cuit}</span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-400 font-medium">Sigla</span>
                                    <span className="block text-gray-700 mt-1">{p.sigla}</span>
                                  </div>
                                  <div className="col-span-2 mt-4">
                                    <button onClick={() => handleOpenListaModal(p)} className="bg-green-700 text-white px-4 py-2 rounded mr-2 hover:bg-green-800">Cargar Lista de Precios</button>
                                    <button onClick={() => handleOpenHistorialModal(p)} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800">Ver Historial</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {activeTab === 'nuevo' && (
              <div className="flex justify-center items-center min-h-[60vh]">
                <ProveedorForm
                  onSave={handleSaveProveedor}
                  onCancel={() => closeTab('nuevo')}
                  initialData={editProveedor}
                  formError={formError}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modales */}
      <ListaPreciosModal
        open={showListaModal}
        onClose={() => setShowListaModal(false)}
        proveedor={proveedorSeleccionado}
        onImport={handleImportLista}
      />
      <HistorialListasModal
        open={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
        proveedor={proveedorHistorial}
        historial={mockHistorial}
      />
    </div>
  );
};

export default ProveedoresManager; 