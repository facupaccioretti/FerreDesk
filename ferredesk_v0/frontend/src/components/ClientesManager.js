import React, { useState, useEffect } from 'react';
import Navbar from "./Navbar";

// --- Mock de datos y servicios ---
const initialClientes = [
  {
    id: 1,
    codigo: '1001',
    razon: 'Empresa Ejemplo S.A.',
    fantasia: 'Ejemplo S.A.',
    domicilio: 'Calle Principal 123',
    tel1: '123-456-7890',
    email: 'contacto@ejemplo.com',
    cuit: '30-12345678-9',
    estado: 'Activo',
  },
  {
    id: 2,
    codigo: '1002',
    razon: 'Comercio XYZ S.R.L.',
    fantasia: 'XYZ',
    domicilio: 'Avenida Central 456',
    tel1: '987-654-3210',
    email: 'info@xyz.com',
    cuit: '30-98765432-1',
    estado: 'Activo',
  },
];

// Simulación de servicios (fácil de reemplazar por fetch/axios en el futuro)
const useClientesService = (initial) => {
  const [clientes, setClientes] = useState(initial);
  const [nextId, setNextId] = useState(initial.length + 1);

  const getClientes = () => clientes;

  const addCliente = (cliente) => {
    setClientes((prev) => [...prev, { ...cliente, id: nextId }]);
    setNextId((id) => id + 1);
  };

  const updateCliente = (id, updated) => {
    setClientes((prev) => prev.map((cli) => (cli.id === id ? { ...cli, ...updated } : cli)));
  };

  const deleteCliente = (id) => {
    setClientes((prev) => prev.filter((cli) => cli.id !== id));
  };

  return { clientes, getClientes, addCliente, updateCliente, deleteCliente };
};

const ClientesTable = ({ clientes, onEdit, onDelete, search, setSearch, expandedClientId, setExpandedClientId }) => {
  const filtered = clientes.filter((cli) =>
    cli.razon.toLowerCase().includes(search.toLowerCase()) ||
    cli.fantasia.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="text"
          className="pl-4 pr-4 py-2 w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar clientes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full">
          <thead>
            <tr className="bg-white border-b">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">RAZÓN SOCIAL</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">NOMBRE COMERCIAL</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 tracking-wider">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filtered.map(cli => (
              <React.Fragment key={cli.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedClientId(expandedClientId === cli.id ? null : cli.id)}
                        className={`flex items-center justify-center w-6 h-6 mr-2 text-gray-700 transition-transform duration-200 ${expandedClientId === cli.id ? 'rotate-90' : 'rotate-0'}`}
                        aria-label={expandedClientId === cli.id ? 'Ocultar detalles' : 'Mostrar detalles'}
                        style={{ padding: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                          <polygon points="5,3 15,10 5,17" />
                        </svg>
                      </button>
                      <span>{cli.razon}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{cli.fantasia}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => onEdit(cli)}
                        title="Editar"
                        className="transition-colors px-1 py-1 text-blue-500 hover:text-blue-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(cli.id)}
                        title="Eliminar"
                        className="transition-colors px-1 py-1 text-red-500 hover:text-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedClientId === cli.id && (
                  <tr className="bg-gray-50">
                    <td colSpan="3" className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                          <span className="block text-gray-400 font-medium">Código</span>
                          <span className="block text-gray-700 mt-1">{cli.codigo}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Razón Social</span>
                          <span className="block text-gray-700 mt-1">{cli.razon}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Nombre Comercial</span>
                          <span className="block text-gray-700 mt-1">{cli.fantasia}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">CUIT</span>
                          <span className="block text-gray-700 mt-1">{cli.cuit}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">IB</span>
                          <span className="block text-gray-700 mt-1">{cli.ib}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Estado</span>
                          <span className="block text-gray-700 mt-1">{cli.estado}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Dirección</span>
                          <span className="block text-gray-700 mt-1">{cli.domicilio}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Teléfono 1</span>
                          <span className="block text-gray-700 mt-1">{cli.tel1}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Teléfono 2</span>
                          <span className="block text-gray-700 mt-1">{cli.tel2}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Teléfono 3</span>
                          <span className="block text-gray-700 mt-1">{cli.tel3}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Email</span>
                          <span className="block text-gray-700 mt-1">{cli.email}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Contacto</span>
                          <span className="block text-gray-700 mt-1">{cli.contacto}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Comentario</span>
                          <span className="block text-gray-700 mt-1">{cli.comentario}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Código Postal</span>
                          <span className="block text-gray-700 mt-1">{cli.cpostal}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Zona</span>
                          <span className="block text-gray-700 mt-1">{cli.zona}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Barrio</span>
                          <span className="block text-gray-700 mt-1">{mockBarrios.find(b => String(b.id) === String(cli.barrio))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Localidad</span>
                          <span className="block text-gray-700 mt-1">{mockLocalidades.find(l => String(l.id) === String(cli.localidad))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Provincia</span>
                          <span className="block text-gray-700 mt-1">{mockProvincias.find(p => String(p.id) === String(cli.provincia))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Tipo de IVA</span>
                          <span className="block text-gray-700 mt-1">{mockIVA.find(i => String(i.id) === String(cli.iva))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Transporte</span>
                          <span className="block text-gray-700 mt-1">{mockTransportes.find(t => String(t.id) === String(cli.transporte))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Vendedor</span>
                          <span className="block text-gray-700 mt-1">{mockVendedores.find(v => String(v.id) === String(cli.vendedor))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Plazo</span>
                          <span className="block text-gray-700 mt-1">{mockPlazos.find(p => String(p.id) === String(cli.plazo))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Categoría</span>
                          <span className="block text-gray-700 mt-1">{mockCategorias.find(c => String(c.id) === String(cli.categoria))?.nombre || ''}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Línea de Crédito</span>
                          <span className="block text-gray-700 mt-1">{cli.lineacred}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Importe Saldo Cta.</span>
                          <span className="block text-gray-700 mt-1">{cli.impsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Fecha Saldo Cta.</span>
                          <span className="block text-gray-700 mt-1">{cli.fecsalcta}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Descuento 1</span>
                          <span className="block text-gray-700 mt-1">{cli.descu1}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Descuento 2</span>
                          <span className="block text-gray-700 mt-1">{cli.descu2}</span>
                        </div>
                        <div>
                          <span className="block text-gray-400 font-medium">Descuento 3</span>
                          <span className="block text-gray-700 mt-1">{cli.descu3}</span>
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
    </div>
  );
};

// MOCKS para campos relacionales
const mockBarrios = [
  { id: 1, nombre: 'Centro' },
  { id: 2, nombre: 'Norte' },
  { id: 3, nombre: 'Sur' },
];
const mockLocalidades = [
  { id: 1, nombre: 'Ciudad A' },
  { id: 2, nombre: 'Ciudad B' },
];
const mockProvincias = [
  { id: 1, nombre: 'Provincia X' },
  { id: 2, nombre: 'Provincia Y' },
];
const mockIVA = [
  { id: 1, nombre: 'Responsable Inscripto' },
  { id: 2, nombre: 'Monotributo' },
  { id: 3, nombre: 'Exento' },
];
const mockTransportes = [
  { id: 1, nombre: 'Transporte 1' },
  { id: 2, nombre: 'Transporte 2' },
];
const mockVendedores = [
  { id: 1, nombre: 'Juan Pérez' },
  { id: 2, nombre: 'María González' },
];
const mockPlazos = [
  { id: 1, nombre: 'Contado' },
  { id: 2, nombre: '30 días' },
];
const mockCategorias = [
  { id: 1, nombre: 'Minorista' },
  { id: 2, nombre: 'Mayorista' },
];

const FilterableSelect = ({ label, options, value, onChange, onAdd, placeholder, addLabel, name }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter(opt => opt.nombre.toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(opt => String(opt.id) === String(value));

  return (
    <div className="mb-2 relative">
      <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center justify-between">
        {label}
        <button type="button" onClick={onAdd} className="ml-2 text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">{addLabel}</button>
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          placeholder={placeholder}
          value={selected ? selected.nombre : search}
          onFocus={() => setOpen(true)}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
            onChange({ target: { name, value: '' } });
          }}
        />
        {open && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded w-full mt-1 max-h-40 overflow-auto shadow-lg">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-gray-400 text-sm">Sin resultados</div>
            )}
            {filtered.map(opt => (
              <div
                key={opt.id}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm ${String(opt.id) === String(value) ? 'bg-gray-100 font-semibold' : ''}`}
                onMouseDown={() => {
                  onChange({ target: { name, value: opt.id } });
                  setSearch(opt.nombre);
                  setOpen(false);
                }}
              >
                {opt.nombre}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const NuevoClienteForm = ({ onSave, onCancel, initialData }) => {
  // Estado para los mocks editables
  const [barrios, setBarrios] = useState([...mockBarrios]);
  const [localidades, setLocalidades] = useState([...mockLocalidades]);
  const [provincias, setProvincias] = useState([...mockProvincias]);

  // Estado para modales
  const [modal, setModal] = useState(null);
  const [newValue, setNewValue] = useState('');

  // Cargar datos guardados o usar initialData
  const [form, setForm] = useState(() => {
    const savedForm = localStorage.getItem('clienteFormDraft');
    if (savedForm && !initialData) {
      return JSON.parse(savedForm);
    }
    return initialData || {
      codigo: '', razon: '', fantasia: '', domicilio: '', tel1: '', tel2: '', tel3: '', email: '', cuit: '', ib: '', status: '', iva: '', contacto: '', comentario: '', lineacred: '', impsalcta: '', fecsalcta: '', descu1: '', descu2: '', descu3: '', cpostal: '', zona: '', cancela: '', barrio: '', localidad: '', provincia: '', transporte: '', vendedor: '', plazo: '', categoria: '', estado: 'Activo'
    };
  });

  const [error, setError] = useState('');

  // Guardar en localStorage cuando el formulario cambie
  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('clienteFormDraft', JSON.stringify(form));
    }
  }, [form, initialData]);

  // Limpiar el draft cuando se guarda o cancela
  const handleSave = (e) => {
    e.preventDefault();
    if (!form.razon.trim() || !form.codigo.trim()) {
      setError('El código y la razón social son obligatorios');
      return;
    }
    setError('');
    localStorage.removeItem('clienteFormDraft');
    onSave(form);
  };

  const handleCancel = () => {
    localStorage.removeItem('clienteFormDraft');
    onCancel();
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Modal handlers
  const openAddModal = (type) => {
    setModal({ type, open: true });
    setNewValue('');
  };
  const closeModal = () => {
    setModal(null);
    setNewValue('');
  };
  const handleAdd = () => {
    if (!newValue.trim()) return;
    if (modal.type === 'barrio') {
      const nuevo = { id: barrios.length + 1, nombre: newValue };
      setBarrios([...barrios, nuevo]);
      setForm({ ...form, barrio: nuevo.id });
    }
    if (modal.type === 'localidad') {
      const nuevo = { id: localidades.length + 1, nombre: newValue };
      setLocalidades([...localidades, nuevo]);
      setForm({ ...form, localidad: nuevo.id });
    }
    if (modal.type === 'provincia') {
      const nuevo = { id: provincias.length + 1, nombre: newValue };
      setProvincias([...provincias, nuevo]);
      setForm({ ...form, provincia: nuevo.id });
    }
    closeModal();
  };

  return (
    <form className="max-w-3xl w-full mx-auto py-8 px-8 bg-white rounded-xl shadow relative" onSubmit={handleSave}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">
        {initialData ? 'Editar Cliente' : 'Nuevo Cliente'}
      </h3>
      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-900 text-red">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Código *</label>
          <input name="codigo" value={form.codigo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Razón Social *</label>
          <input name="razon" value={form.razon} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Nombre Comercial</label>
          <input name="fantasia" value={form.fantasia} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">CUIT</label>
          <input name="cuit" value={form.cuit} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">IB</label>
          <input name="ib" value={form.ib} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Estado</label>
          <select name="estado" value={form.estado} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Dirección</label>
          <input name="domicilio" value={form.domicilio} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Teléfono 1</label>
          <input name="tel1" value={form.tel1} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Teléfono 2</label>
          <input name="tel2" value={form.tel2} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Teléfono 3</label>
          <input name="tel3" value={form.tel3} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
          <input name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Contacto</label>
          <input name="contacto" value={form.contacto} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Comentario</label>
          <input name="comentario" value={form.comentario} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Código Postal</label>
          <input name="cpostal" value={form.cpostal} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Zona</label>
          <input name="zona" value={form.zona} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <FilterableSelect
            label="Barrio"
            name="barrio"
            options={barrios}
            value={form.barrio}
            onChange={handleChange}
            onAdd={() => openAddModal('barrio')}
            placeholder="Buscar barrio..."
            addLabel="Agregar Barrio"
          />
        </div>
        <div>
          <FilterableSelect
            label="Localidad"
            name="localidad"
            options={localidades}
            value={form.localidad}
            onChange={handleChange}
            onAdd={() => openAddModal('localidad')}
            placeholder="Buscar localidad..."
            addLabel="Agregar Localidad"
          />
        </div>
        <div>
          <FilterableSelect
            label="Provincia"
            name="provincia"
            options={provincias}
            value={form.provincia}
            onChange={handleChange}
            onAdd={() => openAddModal('provincia')}
            placeholder="Buscar provincia..."
            addLabel="Agregar Provincia"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Tipo de IVA</label>
          <select name="iva" value={form.iva} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="">Seleccione...</option>
            {mockIVA.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Transporte</label>
          <select name="transporte" value={form.transporte} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="">Seleccione...</option>
            {mockTransportes.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Vendedor</label>
          <select name="vendedor" value={form.vendedor} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="">Seleccione...</option>
            {mockVendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Plazo</label>
          <select name="plazo" value={form.plazo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="">Seleccione...</option>
            {mockPlazos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Categoría</label>
          <select name="categoria" value={form.categoria} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent">
            <option value="">Seleccione...</option>
            {mockCategorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        {/* Otros campos numéricos y de fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Línea de Crédito</label>
          <input name="lineacred" value={form.lineacred} onChange={handleChange} type="number" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Importe Saldo Cta.</label>
          <input name="impsalcta" value={form.impsalcta} onChange={handleChange} type="number" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Fecha Saldo Cta.</label>
          <input name="fecsalcta" value={form.fecsalcta} onChange={handleChange} type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Descuento 1</label>
          <input name="descu1" value={form.descu1} onChange={handleChange} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Descuento 2</label>
          <input name="descu2" value={form.descu2} onChange={handleChange} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Descuento 3</label>
          <input name="descu3" value={form.descu3} onChange={handleChange} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        </div>
      </div>
      {/* Modal flotante para agregar barrio/localidad/provincia */}
      {modal && modal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px]">
            <h4 className="text-lg font-semibold mb-2">Agregar {modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}</h4>
            <input
              type="text"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              placeholder={`Nombre del ${modal.type}`}
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} type="button" className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
              <button onClick={handleAdd} type="button" className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800">Agregar</button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-8 flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          {initialData ? 'Guardar Cambios' : 'Crear Cliente'}
        </button>
      </div>
    </form>
  );
};

const ClientesManager = () => {
  useEffect(() => {
    document.title = "Clientes FerreDesk";
  }, []);

  const {
    clientes,
    addCliente,
    updateCliente,
    deleteCliente,
  } = useClientesService(initialClientes);

  const [search, setSearch] = useState('');
  
  // Cargar estado de pestañas desde localStorage
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem('clientesTabs');
    return savedTabs ? JSON.parse(savedTabs) : [
      { key: 'lista', label: 'Lista de Clientes', closable: false }
    ];
  });

  const [activeTab, setActiveTab] = useState(() => {
    const savedActiveTab = localStorage.getItem('clientesActiveTab');
    return savedActiveTab || 'lista';
  });

  const [editCliente, setEditCliente] = useState(null);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [user, setUser] = useState(null);

  // Guardar estado de pestañas en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('clientesTabs', JSON.stringify(tabs));
    localStorage.setItem('clientesActiveTab', activeTab);
  }, [tabs, activeTab]);

  useEffect(() => {
    fetch("/api/user/", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") setUser(data.user);
      });
  }, []);

  const handleLogout = () => {
    fetch("/api/logout/", { method: "POST", credentials: "include" })
      .then(() => {
        window.location.href = "/login";
      });
  };

  // Abrir nueva subpestaña
  const openTab = (key, label, cliente = null) => {
    setEditCliente(cliente);
    setTabs((prev) => {
      if (prev.find((t) => t.key === key)) return prev;
      return [...prev, { key, label, closable: true }];
    });
    setActiveTab(key);
  };

  // Cerrar subpestaña
  const closeTab = (key) => {
    setTabs((prev) => prev.filter((t) => t.key !== key));
    if (activeTab === key) setActiveTab('lista');
    setEditCliente(null);
  };

  // Guardar cliente (alta o edición)
  const handleSaveCliente = (data) => {
    if (editCliente) {
      updateCliente(editCliente.id, data);
    } else {
      addCliente(data);
    }
    closeTab('nuevo');
  };

  // Eliminar cliente
  const handleDeleteCliente = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este cliente?')) {
      deleteCliente(id);
    }
  };

  // Editar cliente
  const handleEditCliente = (cliente) => {
    openTab('nuevo', 'Nuevo Cliente', cliente);
  };

  return (
    <div className="h-full flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex justify-between items-center px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Clientes</h2>
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
            {/* Botón Nuevo Cliente solo en la tab de lista */}
            {activeTab === 'lista' && (
              <div className="flex-1 flex justify-end mb-2">
                <button
                  onClick={() => openTab('nuevo', 'Nuevo Cliente')}
                  className="bg-black hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                >
                  <span className="text-lg">+</span> Nuevo Cliente
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 bg-white rounded-b-xl shadow-sm min-h-0 p-6">
            {activeTab === 'lista' && (
              <ClientesTable
                clientes={clientes}
                onEdit={handleEditCliente}
                onDelete={handleDeleteCliente}
                search={search}
                setSearch={setSearch}
                expandedClientId={expandedClientId}
                setExpandedClientId={setExpandedClientId}
              />
            )}
            {activeTab === 'nuevo' && (
              <div className="flex justify-center items-center min-h-[60vh]">
                <NuevoClienteForm
                  onSave={handleSaveCliente}
                  onCancel={() => closeTab('nuevo')}
                  initialData={editCliente}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modificar ClientesTable para alinear acciones correctamente
ClientesTable.defaultProps = {
  expandedClientId: null,
  setExpandedClientId: () => {},
};

export default ClientesManager; 