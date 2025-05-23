import React, { useEffect, useState } from 'react';
import Navbar from "./Navbar";
import ListaPreciosModal from "./ListaPreciosModal";
import HistorialListasModal from "./HistorialListasModal";
import ProveedorForm from "./ProveedorForm";
import { useProveedoresAPI } from '../utils/useProveedoresAPI';
import { BotonEditar, BotonEliminar, BotonExpandir, BotonHistorial, BotonCargarLista } from "./Botones";

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
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <div className="container mx-auto px-6 py-8 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Gestión de Proveedores</h2>
        </div>
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
          {/* Tabs tipo browser */}
          <div className="flex items-center border-b border-gray-200 px-6 pt-3">
            {tabs.map(tab => (
              <div
                key={tab.key}
                className={`flex items-center px-5 py-3 mr-2 rounded-t-lg cursor-pointer transition-colors ${activeTab === tab.key ? 'bg-white border border-b-0 border-gray-200 font-semibold text-gray-900' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ position: 'relative' }}
              >
                {tab.label}
                {tab.closable && (
                  <button
                    onClick={e => { e.stopPropagation(); closeTab(tab.key); }}
                    className="ml-3 text-lg font-bold text-gray-400 hover:text-red-500 focus:outline-none transition-colors"
                    title="Cerrar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {/* Botón Nuevo Proveedor solo en la tab de lista */}
            {activeTab === 'lista' && (
              <div className="flex-1 flex justify-end mb-1">
                <button
                  onClick={() => openTab('nuevo', 'Nuevo Proveedor')}
                  className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm shadow-sm"
                >
                  <span className="text-lg">+</span> Nuevo Proveedor
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 p-6">
            {activeTab === 'lista' && (
              <>
                <div className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      className="pl-10 pr-4 py-3 w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
                      placeholder="Buscar proveedor por nombre, fantasía o CUIT..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                      />
                    </svg>
                  </div>
                </div>
                {loading && (
                  <div className="text-gray-500 mb-4 flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Cargando proveedores...
                  </div>
                )}
                {error && (
                  <div className="text-red-600 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">{error}</div>
                )}
                <div className="overflow-hidden rounded-xl shadow-sm border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">RAZÓN SOCIAL</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">FANTASIA</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DOMICILIO</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TELÉFONO</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CUIT</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SIGLA</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {proveedoresFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                              {search
                                ? "No se encontraron proveedores con ese criterio de búsqueda"
                                : "No hay proveedores registrados"}
                            </td>
                          </tr>
                        ) : (
                          proveedoresFiltrados.map((p) => (
                            <React.Fragment key={p.id}>
                              <tr className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                  <div className="flex items-center">
                                    <BotonExpandir
                                      expanded={expandedId === p.id}
                                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                      title={expandedId === p.id ? "Ocultar detalles" : "Mostrar detalles"}
                                    />
                                    <span>{p.razon}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.fantasia}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.domicilio}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.tel1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.cuit}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.sigla}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex gap-3 items-center">
                                    <BotonEditar onClick={() => handleEditProveedor(p)} title="Editar proveedor" />
                                    <BotonEliminar onClick={() => handleDelete(p.id)} title="Eliminar proveedor" />
                                    <BotonCargarLista
                                      onClick={() => handleOpenListaModal(p)}
                                      title="Cargar lista de precios"
                                    />
                                    <BotonHistorial
                                      onClick={() => handleOpenHistorialModal(p)}
                                      title="Ver historial de listas"
                                    />
                                  </div>
                                </td>
                              </tr>
                              {expandedId === p.id && (
                                <tr className="bg-gray-50">
                                  <td colSpan={7} className="px-6 py-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">Razón Social</span>
                                        <span className="block text-gray-800 font-medium">{p.razon}</span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">Nombre de Fantasía</span>
                                        <span className="block text-gray-800 font-medium">{p.fantasia}</span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">Domicilio</span>
                                        <span className="block text-gray-800 font-medium">{p.domicilio}</span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">Teléfono</span>
                                        <span className="block text-gray-800 font-medium">{p.tel1}</span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">CUIT</span>
                                        <span className="block text-gray-800 font-medium">{p.cuit}</span>
                                      </div>
                                      <div>
                                        <span className="block text-gray-500 font-medium mb-1">Sigla</span>
                                        <span className="block text-gray-800 font-medium">{p.sigla}</span>
                                      </div>
                                      <div className="col-span-2 mt-4 flex gap-3">
                                        <button
                                          onClick={() => handleOpenListaModal(p)}
                                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
                                        >
                                          Cargar Lista de Precios
                                        </button>
                                        <button
                                          onClick={() => handleOpenHistorialModal(p)}
                                          className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
                                        >
                                          Ver Historial
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'nuevo' && (
              <div className="flex justify-center items-start py-4">
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