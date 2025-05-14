import React, { useState, useEffect } from 'react';
import Navbar from "./Navbar";

// Mock de presupuestos/ventas
const initialPresupuestos = [
  {
    id: 1,
    numero: 'P-0001',
    cliente: 'Empresa Ejemplo S.A.',
    fecha: '2024-06-01',
    estado: 'Abierto',
    total: 15000,
    tipo: 'Presupuesto',
    items: [
      { id: 1, producto: { id: 1, codigo: 'P001', nombre: 'Tornillo 2"', precio: 100 }, cantidad: 10, precio: 100, subtotal: 1000 },
      { id: 2, producto: { id: 2, codigo: 'P002', nombre: 'Martillo', precio: 500 }, cantidad: 2, precio: 500, subtotal: 1000 }
    ]
  },
  {
    id: 2,
    numero: 'P-0002',
    cliente: 'Comercio XYZ S.R.L.',
    fecha: '2024-06-02',
    estado: 'Convertido',
    total: 25000,
    tipo: 'Venta',
    items: [
      { id: 3, producto: { id: 3, codigo: 'P003', nombre: 'Destornillador', precio: 300 }, cantidad: 5, precio: 300, subtotal: 1500 }
    ]
  },
];

// Mock de productos disponibles
const productosDisponibles = [
  { id: 1, codigo: 'P001', nombre: 'Tornillo 2"', precio: 100 },
  { id: 2, codigo: 'P002', nombre: 'Martillo', precio: 500 },
  { id: 3, codigo: 'P003', nombre: 'Destornillador', precio: 300 },
  { id: 4, codigo: 'P004', nombre: 'Taladro', precio: 2000 },
  { id: 5, codigo: 'P005', nombre: 'Sierra', precio: 800 },
];

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'abiertos', label: 'Abiertos' },
  { key: 'cerrados', label: 'Cerrados' },
  { key: 'convertidos', label: 'Convertidos' },
];

// Componente para la grilla de ítems
const ItemsGrid = ({ items, onAddItem, onEditItem, onDeleteItem, productosDisponibles, autoSumarDuplicados, setAutoSumarDuplicados }) => {
  const [selectedProducto, setSelectedProducto] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [showDuplicadoModal, setShowDuplicadoModal] = useState(false);
  const [duplicadoInfo, setDuplicadoInfo] = useState(null);

  const handleAddItem = () => {
    if (!selectedProducto) return;
    
    const producto = productosDisponibles.find(p => p.id === parseInt(selectedProducto));
    const itemExistente = items.find(item => item.producto.id === producto.id);

    if (itemExistente && !autoSumarDuplicados) {
      setDuplicadoInfo({
        producto,
        itemExistente,
        cantidad: parseInt(cantidad)
      });
      setShowDuplicadoModal(true);
      return;
    }

    if (itemExistente && autoSumarDuplicados) {
      onEditItem(itemExistente.id, {
        ...itemExistente,
        cantidad: itemExistente.cantidad + parseInt(cantidad),
        subtotal: (itemExistente.cantidad + parseInt(cantidad)) * itemExistente.precio
      });
    } else {
      onAddItem({
        id: Math.max(0, ...items.map(i => i.id)) + 1,
        producto,
        cantidad: parseInt(cantidad),
        precio: producto.precio,
        subtotal: producto.precio * parseInt(cantidad)
      });
    }

    setSelectedProducto('');
    setCantidad(1);
  };

  const handleDuplicadoAction = (action) => {
    if (action === 'sumar') {
      onEditItem(duplicadoInfo.itemExistente.id, {
        ...duplicadoInfo.itemExistente,
        cantidad: duplicadoInfo.itemExistente.cantidad + duplicadoInfo.cantidad,
        subtotal: (duplicadoInfo.itemExistente.cantidad + duplicadoInfo.cantidad) * duplicadoInfo.itemExistente.precio
      });
    } else if (action === 'eliminar') {
      onDeleteItem(duplicadoInfo.itemExistente.id);
      onAddItem({
        id: Math.max(0, ...items.map(i => i.id)) + 1,
        producto: duplicadoInfo.producto,
        cantidad: duplicadoInfo.cantidad,
        precio: duplicadoInfo.producto.precio,
        subtotal: duplicadoInfo.producto.precio * duplicadoInfo.cantidad
      });
    }
    setShowDuplicadoModal(false);
    setDuplicadoInfo(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <select
            value={selectedProducto}
            onChange={(e) => setSelectedProducto(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          >
            <option value="">Seleccionar producto...</option>
            {productosDisponibles.map(p => (
              <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            min="1"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <button
          onClick={handleAddItem}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Agregar
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="autoSumar"
          checked={autoSumarDuplicados}
          onChange={(e) => setAutoSumarDuplicados(e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="autoSumar" className="text-sm text-gray-600">
          Sumar cantidades automáticamente al agregar productos duplicados
        </label>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap">
                {item.producto.codigo} - {item.producto.nombre}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={(e) => {
                    const newCantidad = parseInt(e.target.value);
                    onEditItem(item.id, {
                      ...item,
                      cantidad: newCantidad,
                      subtotal: newCantidad * item.precio
                    });
                  }}
                  min="1"
                  className="w-20 px-2 py-1 border border-gray-200 rounded"
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <input
                  type="number"
                  value={item.precio}
                  onChange={(e) => {
                    const newPrecio = parseFloat(e.target.value);
                    onEditItem(item.id, {
                      ...item,
                      precio: newPrecio,
                      subtotal: item.cantidad * newPrecio
                    });
                  }}
                  min="0"
                  step="0.01"
                  className="w-24 px-2 py-1 border border-gray-200 rounded"
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">${item.subtotal}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de duplicado */}
      {showDuplicadoModal && duplicadoInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Producto duplicado</h3>
            <p className="mb-4">
              El producto {duplicadoInfo.producto.nombre} ya fue cargado. ¿Qué desea hacer?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleDuplicadoAction('sumar')}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                Sumar cantidades
              </button>
              <button
                onClick={() => handleDuplicadoAction('eliminar')}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Eliminar anterior
              </button>
              <button
                onClick={() => setShowDuplicadoModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PresupuestosManager = () => {
  useEffect(() => {
    document.title = "Presupuestos y Ventas FerreDesk";
  }, []);

  const [presupuestos, setPresupuestos] = useState(initialPresupuestos);
  const [filtro, setFiltro] = useState('todos');
  const [tabs, setTabs] = useState([
    { key: 'lista', label: 'Presupuestos y Ventas', closable: false }
  ]);
  const [activeTab, setActiveTab] = useState('lista');
  const [editPresupuesto, setEditPresupuesto] = useState(null);
  const [user, setUser] = useState({ username: "ferreadmin" });
  const [autoSumarDuplicados, setAutoSumarDuplicados] = useState(false);

  // Filtros
  const filtrar = (lista) => {
    switch (filtro) {
      case 'presupuestos':
        return lista.filter(p => p.tipo === 'Presupuesto');
      case 'ventas':
        return lista.filter(p => p.tipo === 'Venta');
      case 'facturas':
        return lista.filter(p => p.tipo === 'Factura');
      case 'abiertos':
        return lista.filter(p => p.estado === 'Abierto');
      case 'cerrados':
        return lista.filter(p => p.estado === 'Cerrado');
      case 'convertidos':
        return lista.filter(p => p.estado === 'Convertido');
      default:
        return lista;
    }
  };

  // Acciones
  const handleNuevo = () => {
    setEditPresupuesto(null);
    setTabs(prev => [...prev, { key: 'nuevo', label: 'Nuevo Presupuesto', closable: true }]);
    setActiveTab('nuevo');
  };

  const handleEdit = (presupuesto) => {
    setEditPresupuesto(presupuesto);
    setTabs(prev => [...prev, { key: 'editar', label: 'Editar Presupuesto', closable: true }]);
    setActiveTab('editar');
  };

  const handleConvertir = (presupuesto) => {
    // Simula conversión heredando datos
    alert(`Convertir presupuesto ${presupuesto.numero} a Venta o Factura (heredando datos)`);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este presupuesto/venta?')) {
      setPresupuestos(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleRefresh = () => {
    // Simula refresco
    alert('Refrescando datos...');
  };

  // Tabs y cierre
  const closeTab = (key) => {
    setTabs(prev => prev.filter(t => t.key !== key));
    setActiveTab('lista');
    setEditPresupuesto(null);
  };

  // Formulario de alta/edición
  const PresupuestoForm = ({ onSave, onCancel, initialData }) => {
    const [form, setForm] = useState(initialData || {
      numero: '',
      cliente: '',
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Abierto',
      tipo: 'Presupuesto',
      items: []
    });

    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const handleAddItem = (item) => {
      setForm(prev => ({
        ...prev,
        items: [...prev.items, item],
        total: prev.items.reduce((sum, i) => sum + i.subtotal, 0) + item.subtotal
      }));
    };

    const handleEditItem = (id, updatedItem) => {
      setForm(prev => ({
        ...prev,
        items: prev.items.map(item => item.id === id ? updatedItem : item),
        total: prev.items.reduce((sum, i) => sum + (i.id === id ? updatedItem.subtotal : i.subtotal), 0)
      }));
    };

    const handleDeleteItem = (id) => {
      setForm(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== id),
        total: prev.items.reduce((sum, i) => sum + (i.id === id ? 0 : i.subtotal), 0)
      }));
    };

    const handleSubmit = e => {
      e.preventDefault();
      onSave(form);
    };

    return (
      <form className="max-w-4xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
        <h3 className="text-xl font-semibold text-gray-800 mb-6">{initialData ? 'Editar' : 'Nuevo'} Presupuesto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">N° Presupuesto</label>
            <input name="numero" value={form.numero} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Cliente</label>
            <input name="cliente" value={form.cliente} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Fecha</label>
            <input name="fecha" type="date" value={form.fecha} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Total</label>
            <input type="text" value={`$${form.total || 0}`} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" readOnly />
          </div>
        </div>

        <div className="mb-8">
          <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems del Presupuesto</h4>
          <ItemsGrid
            items={form.items}
            onAddItem={handleAddItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            productosDisponibles={productosDisponibles}
            autoSumarDuplicados={autoSumarDuplicados}
            setAutoSumarDuplicados={setAutoSumarDuplicados}
          />
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors">Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">{initialData ? 'Guardar Cambios' : 'Crear Presupuesto'}</button>
        </div>
      </form>
    );
  };

  // Guardar presupuesto (alta o edición)
  const handleSavePresupuesto = (data) => {
    if (editPresupuesto) {
      setPresupuestos(prev => prev.map(p => p.id === editPresupuesto.id ? { ...p, ...data } : p));
    } else {
      setPresupuestos(prev => [...prev, { ...data, id: prev.length + 1 }]);
    }
    closeTab('nuevo');
    closeTab('editar');
  };

  return (
    <div className="h-full flex flex-col">
      <Navbar user={user} onLogout={() => {}} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Presupuestos y Ventas</h2>
        <button onClick={handleRefresh} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors text-sm">Refrescar</button>
      </div>
      <div className="flex gap-2 px-6 mb-4">
        {filtros.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${filtro === f.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={handleNuevo}
          className="ml-auto bg-black hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
        >
          <span className="text-lg">+</span> Nuevo Presupuesto
        </button>
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm min-h-0 p-6">
        {activeTab === 'lista' && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N°</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrar(presupuestos).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{p.numero}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.cliente}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.estado}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.tipo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">${p.total}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">Editar</button>
                      <button onClick={() => handleConvertir(p)} className="text-green-600 hover:underline">Convertir</button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(activeTab === 'nuevo' || activeTab === 'editar') && (
          <PresupuestoForm
            onSave={handleSavePresupuesto}
            onCancel={() => closeTab(activeTab)}
            initialData={editPresupuesto}
          />
        )}
      </div>
    </div>
  );
};

export default PresupuestosManager; 