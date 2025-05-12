import React, { useEffect, useState } from 'react';
import Navbar from "./Navbar";
import StockForm from './StockForm';
import ProductosTable from './ProductosTable';

// Datos mock iniciales
const mockFamilias = [
  { id: 1, deno: 'Caños', comentario: '', nivel: '1', acti: 'S' },
  { id: 2, deno: 'Tornillos', comentario: '', nivel: '1', acti: 'S' },
];
const mockProveedores = [
  { id: 1, razon: 'Juan' },
  { id: 2, razon: 'Marquitos' },
  { id: 3, razon: 'Ferretería S.A.' }
];
const mockProductos = [
  {
    id: 1,
    codvta: 'PVC001',
    deno: 'Tubo PVC 1"',
    unidad: 'm',
    idfam1: 1,
    stock_proveedores: [
      { id: 1, proveedor: 1, cantidad: 50, costo: 100 },
      { id: 2, proveedor: 2, cantidad: 30, costo: 110 }
    ]
  },
  {
    id: 2,
    codvta: 'TOR002',
    deno: 'Tornillo 2"',
    unidad: 'unidad',
    idfam1: 2,
    stock_proveedores: [
      { id: 3, proveedor: 3, cantidad: 200, costo: 2 }
    ]
  }
];

export default function ProductosManager() {
  // Estado
  const [productos, setProductos] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [search, setSearch] = useState('');
  const [tabs, setTabs] = useState([{ key: 'lista', label: 'Lista de Productos', closable: false }]);
  const [activeTab, setActiveTab] = useState('lista');
  const [editProducto, setEditProducto] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [groupByFamilia, setGroupByFamilia] = useState(false);
  const [updateStockModal, setUpdateStockModal] = useState({ show: false, stockId: null, providerId: null });
  const [user, setUser] = useState({ username: "ferreadmin" }); // o el usuario real

  // Simula fetch inicial
  useEffect(() => {
    setFamilias(mockFamilias);
    setProveedores(mockProveedores);
    setProductos(mockProductos);
  }, []);

  // CRUD Familias
  const addFamilia = (familia) => setFamilias(prev => [...prev, { ...familia, id: prev.length + 1 }]);
  const updateFamilia = (id, updated) => setFamilias(prev => prev.map(f => f.id === id ? { ...f, ...updated } : f));
  const deleteFamilia = (id) => setFamilias(prev => prev.filter(f => f.id !== id));

  // CRUD Proveedores
  const addProveedor = (proveedor) => setProveedores(prev => [...prev, { ...proveedor, id: prev.length + 1 }]);
  const updateProveedor = (id, updated) => setProveedores(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  const deleteProveedor = (id) => setProveedores(prev => prev.filter(p => p.id !== id));

  // Tabs y edición
  const openTab = (key, label, producto = null) => {
    setEditProducto(producto);
    setTabs(prev => {
      if (prev.find(t => t.key === key)) return prev;
      return [...prev, { key, label, closable: true }];
    });
    setActiveTab(key);
  };
  const closeTab = (key) => {
    setTabs(prev => prev.filter(t => t.key !== key));
    if (activeTab === key) setActiveTab('lista');
    setEditProducto(null);
  };

  // Guardar producto (alta o edición)
  const handleSaveProducto = async (data) => {
    if (editProducto) {
      // Edición
      setProductos(prev => prev.map(p => 
        p.id === editProducto.id ? { ...p, ...data } : p
      ));
    } else {
      // Alta
      const newProducto = {
        ...data,
        id: Math.max(0, ...productos.map(p => p.id)) + 1
      };
      setProductos(prev => [...prev, newProducto]);
    }
    closeTab('nuevo');
  };

  // Editar producto
  const handleEditProducto = (producto) => {
    openTab('nuevo', 'Editar Producto', producto);
  };

  // Actualizar stock de un proveedor específico
  const handleUpdateStock = (stockId, providerId) => {
    setUpdateStockModal({ show: true, stockId, providerId });
  };

  const handleStockUpdate = (stockId, providerId, cantidad, costo) => {
    setProductos(prev => prev.map(producto => {
      if (producto.id === stockId) {
        return {
          ...producto,
          stock_proveedores: producto.stock_proveedores.map(sp => 
            sp.proveedor.id === providerId 
              ? { ...sp, cantidad: Number(cantidad), costo: Number(costo) }
              : sp
          )
        };
      }
      return producto;
    }));
    setUpdateStockModal({ show: false, stockId: null, providerId: null });
  };

  const handleLogout = () => {
    // Aquí tu lógica real de logout (borrar token, limpiar storage, redirigir, etc)
    setUser(null);
    window.location.href = "/login"; // o la ruta de tu login
  };

  return (
    <div className="h-full flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Productos y Stock</h2>
        <div>
          <label className="mr-2 font-medium text-gray-700">Agrupar por familia</label>
          <input
            type="checkbox"
            checked={groupByFamilia}
            onChange={e => setGroupByFamilia(e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600"
          />
        </div>
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
            {/* Botón Nuevo Producto solo en la tab de lista */}
            {activeTab === 'lista' && (
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => openTab('nuevo', 'Nuevo Producto')}
                  className="bg-black hover:bg-gray-900 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors"
                >
                  <span className="text-xl">+</span> Nuevo Producto
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-sm min-h-0 p-6">
            {activeTab === 'lista' && (
              <ProductosTable
                productos={productos}
                familias={familias}
                proveedores={proveedores}
                setProveedores={setProveedores}
                search={search}
                setSearch={setSearch}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                groupByFamilia={groupByFamilia}
                addFamilia={addFamilia}
                updateFamilia={updateFamilia}
                deleteFamilia={deleteFamilia}
                addProveedor={addProveedor}
                updateProveedor={updateProveedor}
                deleteProveedor={deleteProveedor}
                onEdit={handleEditProducto}
                onUpdateStock={handleUpdateStock}
              />
            )}
            {activeTab === 'nuevo' && (
              <StockForm
                stock={editProducto}
                onSave={handleSaveProducto}
                onCancel={() => closeTab('nuevo')}
                proveedores={proveedores}
                familias={familias}
              />
            )}
          </div>
        </div>
      </div>
      {/* Modal para actualizar stock (puedes dejarlo igual o mejorarlo luego) */}
      {updateStockModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Actualizar Stock</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleStockUpdate(
                updateStockModal.stockId,
                updateStockModal.providerId,
                formData.get('cantidad'),
                formData.get('costo')
              );
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Nueva Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Nuevo Costo</label>
                <input
                  type="number"
                  name="costo"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setUpdateStockModal({ show: false, stockId: null, providerId: null })}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 