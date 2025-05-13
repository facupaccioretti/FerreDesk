import React, { useState } from 'react';

// Proveedores mock iniciales
const PROVEEDORES_MOCK = [
  { id: 1, razon: 'Juan', fantasia: 'Juan SRL', domicilio: 'Calle 1', tel1: '123', cuit: '20-12345678-9' },
  { id: 2, razon: 'Marquitos', fantasia: 'Marquitos SA', domicilio: 'Calle 2', tel1: '456', cuit: '20-98765432-1' },
  { id: 3, razon: 'Ferretería S.A.', fantasia: 'Ferretería S.A.', domicilio: 'Calle 3', tel1: '789', cuit: '30-11112222-3' },
];

const getStockTotal = (stock_proveedores) =>
  stock_proveedores.reduce((sum, sp) => sum + (Number(sp.cantidad) || 0), 0);

function ProveedoresModal({ open, onClose, proveedores, setProveedores }) {
  const [form, setForm] = useState({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '' });
  const [editId, setEditId] = useState(null);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!form.razon) return alert('La razón social es obligatoria');
    if (editId) {
      setProveedores(prev => prev.map(p => p.id === editId ? { ...p, ...form } : p));
    } else {
      const newId = Math.max(0, ...proveedores.map(p => p.id)) + 1;
      setProveedores(prev => [...prev, { ...form, id: newId }]);
    }
    setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '' });
    setEditId(null);
  };

  const handleEdit = (prov) => {
    setForm({ razon: prov.razon, fantasia: prov.fantasia, domicilio: prov.domicilio, tel1: prov.tel1, cuit: prov.cuit });
    setEditId(prov.id);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar proveedor?')) {
      setProveedores(prev => prev.filter(p => p.id !== id));
      if (editId === id) {
        setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '' });
        setEditId(null);
      }
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Gestión de Proveedores</h2>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <input name="razon" value={form.razon} onChange={handleChange} placeholder="Razón social*" className="border rounded p-2" />
          <input name="fantasia" value={form.fantasia} onChange={handleChange} placeholder="Nombre de fantasía" className="border rounded p-2" />
          <input name="domicilio" value={form.domicilio} onChange={handleChange} placeholder="Domicilio" className="border rounded p-2" />
          <input name="tel1" value={form.tel1} onChange={handleChange} placeholder="Teléfono" className="border rounded p-2" />
          <input name="cuit" value={form.cuit} onChange={handleChange} placeholder="CUIT" className="border rounded p-2 col-span-2" />
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold">
            {editId ? 'Guardar cambios' : 'Agregar proveedor'}
          </button>
          {editId && (
            <button onClick={() => { setForm({ razon: '', fantasia: '', domicilio: '', tel1: '', cuit: '' }); setEditId(null); }} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100">Cancelar</button>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1">Razón</th>
              <th className="px-2 py-1">Fantasia</th>
              <th className="px-2 py-1">Tel</th>
              <th className="px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map(p => (
              <tr key={p.id}>
                <td className="px-2 py-1">{p.razon}</td>
                <td className="px-2 py-1">{p.fantasia}</td>
                <td className="px-2 py-1">{p.tel1}</td>
                <td className="px-2 py-1 flex gap-2">
                  <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Modal para ABM de Familias
function FamiliasModal({ open, onClose, familias, addFamilia, updateFamilia, deleteFamilia }) {
  const [form, setForm] = useState({ deno: '', comentario: '', nivel: '', acti: 'S' });
  const [editId, setEditId] = useState(null);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = () => {
    if (!form.deno) return alert('El nombre es obligatorio');
    if (!form.nivel) return alert('El nivel es obligatorio');
    if (editId) {
      updateFamilia(editId, form);
    } else {
      addFamilia(form);
    }
    setForm({ deno: '', comentario: '', nivel: '', acti: 'S' });
    setEditId(null);
  };

  const handleEdit = fam => {
    setForm({ deno: fam.deno, comentario: fam.comentario, nivel: fam.nivel, acti: fam.acti });
    setEditId(fam.id);
  };

  const handleDelete = id => {
    if (window.confirm('¿Eliminar familia?')) deleteFamilia(id);
    if (editId === id) {
      setForm({ deno: '', comentario: '', nivel: '', acti: 'S' });
      setEditId(null);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-bold mb-4">Gestión de Familias</h2>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <input name="deno" value={form.deno} onChange={handleChange} placeholder="Nombre*" className="border rounded p-2" />
          <input name="comentario" value={form.comentario} onChange={handleChange} placeholder="Comentario" className="border rounded p-2" />
          <select name="nivel" value={form.nivel} onChange={handleChange} className="border rounded p-2">
            <option value="">Nivel*</option>
            <option value="1">1 (Familia)</option>
            <option value="2">2 (Subfamilia)</option>
            <option value="3">3 (Sub-subfamilia)</option>
          </select>
          <select name="acti" value={form.acti} onChange={handleChange} className="border rounded p-2">
            <option value="S">Activa</option>
            <option value="N">Inactiva</option>
          </select>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold">
            {editId ? 'Guardar cambios' : 'Agregar familia'}
          </button>
          {editId && (
            <button onClick={() => { setForm({ deno: '', comentario: '', nivel: '', acti: 'S' }); setEditId(null); }} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100">Cancelar</button>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1">Nombre</th>
              <th className="px-2 py-1">Comentario</th>
              <th className="px-2 py-1">Nivel</th>
              <th className="px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {familias.map(f => (
              <tr key={f.id}>
                <td className="px-2 py-1">{f.deno}</td>
                <td className="px-2 py-1">{f.comentario}</td>
                <td className="px-2 py-1">{f.nivel}</td>
                <td className="px-2 py-1 flex gap-2">
                  <button onClick={() => handleEdit(f)} className="text-blue-600 hover:underline">Editar</button>
                  <button onClick={() => handleDelete(f.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProductosTable({
  productos,
  familias,
  proveedores,
  setProveedores,
  search,
  setSearch,
  expandedId,
  setExpandedId,
  groupByFamilia,
  setGroupByFamilia,
  selectedNivel,
  setSelectedNivel,
  addFamilia,
  updateFamilia,
  deleteFamilia,
  addProveedor,
  updateProveedor,
  deleteProveedor,
  onEdit,
  onUpdateStock
}) {
  const [showProvModal, setShowProvModal] = useState(false);
  const [showFamiliasModal, setShowFamiliasModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // --- Buscador adaptativo ---
  // Si está en modo familia, filtra familias por nombre
  const familiasFiltradas = groupByFamilia
    ? familias.filter(fam => fam.deno.toLowerCase().includes(search.toLowerCase()))
    : familias;

  // Si está en modo normal, filtra productos por atributos
  const productosFiltrados = !groupByFamilia
    ? productos.filter(prod =>
        (prod.codvta?.toLowerCase().includes(search.toLowerCase()) ||
         prod.codcom?.toLowerCase().includes(search.toLowerCase()) ||
         prod.deno?.toLowerCase().includes(search.toLowerCase()))
      )
    : productos;

  // Agrupación por familia (solo muestra familias filtradas)
  const productosPorFamilia = (familiasFiltradas || [])
    .filter(fam => fam.nivel === selectedNivel)
    .map(fam => ({
      familia: fam,
      productos: productosFiltrados.filter(p => {
        if (selectedNivel === '1') return p.idfam1 === fam.id;
        if (selectedNivel === '2') return p.idfam2 === fam.id;
        if (selectedNivel === '3') return p.idfam3 === fam.id;
        return false;
      })
    }));

  // Función para manejar la expansión/colapso
  const toggleRow = (productId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Función auxiliar para obtener el nombre de familia por id
  const getFamiliaNombre = (id) => {
    const fam = familias.find(f => f.id === id);
    return fam ? fam.deno : 'Sin asignar';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          className="pl-3 pr-3 py-1 w-64 rounded border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder={groupByFamilia ? "Buscar familia..." : "Buscar producto..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowProvModal(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Gestionar Proveedores
        </button>
        <button
          onClick={() => setShowFamiliasModal(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Gestionar Familias
        </button>
      </div>
      
      <div className="overflow-auto flex-1">
        {groupByFamilia && (
          <div className="mb-4 flex items-center gap-2">
            <select
              value={selectedNivel}
              onChange={(e) => setSelectedNivel(e.target.value)}
              className="pl-3 pr-3 py-1 rounded border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="1">Nivel 1 (Familia)</option>
              <option value="2">Nivel 2 (Subfamilia)</option>
              <option value="3">Nivel 3 (Sub-subfamilia)</option>
            </select>
            <button
              onClick={() => setGroupByFamilia(false)}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Ver Lista Normal
            </button>
          </div>
        )}
        
        {!groupByFamilia && (
          <div className="mb-4">
            <button
              onClick={() => setGroupByFamilia(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Agrupar por Familias
            </button>
          </div>
        )}
        
        {groupByFamilia ? (
          <div className="overflow-auto flex-1">
            {(productosPorFamilia || []).map(({ familia, productos }) => (
              <div key={familia.id} className="mb-4">
                <h3 className="text-base font-bold text-gray-700 mb-1">{familia.deno}</h3>
                {productos.length === 0 ? (
                  <div className="text-gray-400 italic mb-2 text-xs">Sin productos en esta familia.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Código
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Familia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subfamilia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sub-subfamilia
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productos.map((product) => (
                          <React.Fragment key={product.id}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => toggleRow(product.id)}
                                    className={`flex items-center justify-center w-6 h-6 mx-1 text-gray-700 transition-transform duration-200 ${expandedRows.has(product.id) ? 'rotate-90' : 'rotate-0'}`}
                                    aria-label={expandedRows.has(product.id) ? 'Ocultar detalles' : 'Mostrar detalles'}
                                    style={{ padding: 0 }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                                      <polygon points="5,3 15,10 5,17" />
                                    </svg>
                                  </button>
                                  <span className="text-sm font-medium text-gray-900">
                                    {product.deno}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {product.codvta}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {getFamiliaNombre(product.idfam1)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {getFamiliaNombre(product.idfam2)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {getFamiliaNombre(product.idfam3)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {product.stock_proveedores?.reduce((acc, sp) => acc + sp.cantidad, 0) || 0}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                <button
                                  onClick={() => onEdit(product)}
                                  className="text-blue-600 hover:text-blue-900 mr-2"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => deleteProveedor(product.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                            {expandedRows.has(product.id) && (
                              <tr>
                                <td colSpan="6" className="px-3 py-2 bg-gray-50">
                                  <div className="p-4">
                                    <h4 className="font-medium mb-2">Detalles del Producto</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p><span className="font-medium">Código de Compra:</span> {product.codcom}</p>
                                        <p><span className="font-medium">Unidad:</span> {product.unidad}</p>
                                        <p><span className="font-medium">Cantidad Mínima:</span> {product.cantmin}</p>
                                        <p><span className="font-medium">Proveedor Habitual:</span> {product.proveedor_habitual?.razon || 'No asignado'}</p>
                                      </div>
                                      <div>
                                        <h5 className="font-medium mb-2">Stock por Proveedor:</h5>
                                        {(product.stock_proveedores || []).map((sp, index) => (
                                          <div key={index} className="text-sm mb-1">
                                            {sp.proveedor?.razon || '-'}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <p><span className="font-medium">Familia:</span> {getFamiliaNombre(product.idfam1)}</p>
                                      <p><span className="font-medium">Subfamilia:</span> {getFamiliaNombre(product.idfam2)}</p>
                                      <p><span className="font-medium">Sub-subfamilia:</span> {getFamiliaNombre(product.idfam3)}</p>
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
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Venta</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Compra</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Familia</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subfamilia</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub-subfamilia</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(productosFiltrados || []).map((product) => (
                  <React.Fragment key={product.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleRow(product.id)}
                            className={`flex items-center justify-center w-6 h-6 mx-1 text-gray-700 transition-transform duration-200 ${expandedRows.has(product.id) ? 'rotate-90' : 'rotate-0'}`}
                            aria-label={expandedRows.has(product.id) ? 'Ocultar detalles' : 'Mostrar detalles'}
                            style={{ padding: 0 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="block m-auto">
                              <polygon points="5,3 15,10 5,17" />
                            </svg>
                          </button>
                          <span className="text-sm font-medium text-gray-900">
                            {product.deno}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {product.codvta}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {product.codcom}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {getFamiliaNombre(product.idfam1)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {getFamiliaNombre(product.idfam2)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {getFamiliaNombre(product.idfam3)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {product.stock_proveedores?.reduce((acc, sp) => acc + (Number(sp.cantidad) || 0), 0) || 0}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => onEdit(product)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteProveedor(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(product.id) && (
                      <tr>
                        <td colSpan="7" className="px-3 py-2 bg-gray-50">
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Información General</h4>
                                <p><span className="font-medium">Familia:</span> {getFamiliaNombre(product.idfam1)}</p>
                                <p><span className="font-medium">Subfamilia:</span> {getFamiliaNombre(product.idfam2)}</p>
                                <p><span className="font-medium">Sub-subfamilia:</span> {getFamiliaNombre(product.idfam3)}</p>
                                <p><span className="font-medium">Unidad:</span> {product.unidad}</p>
                                <p><span className="font-medium">Cantidad Mínima:</span> {product.cantmin}</p>
                                <p><span className="font-medium">Proveedor Habitual:</span> {product.proveedor_habitual?.razon || 'No asignado'}</p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Stock por Proveedor</h4>
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-2 py-1 text-left">Proveedor</th>
                                      <th className="px-2 py-1 text-left">Cantidad</th>
                                      <th className="px-2 py-1 text-left">Costo</th>
                                      <th className="px-2 py-1 text-left">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(product.stock_proveedores || []).map((sp, index) => (
                                      <tr key={index}>
                                        <td className="px-2 py-1">{sp.proveedor?.razon || '-'}</td>
                                        <td className="px-2 py-1">{sp.cantidad}</td>
                                        <td className="px-2 py-1">${sp.costo}</td>
                                        <td className="px-2 py-1">
                                          <button
                                            onClick={() => onUpdateStock(product.id, sp.proveedor?.id)}
                                            className="text-blue-600 hover:text-blue-900 text-xs"
                                          >
                                            Actualizar
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
        )}
      </div>
      <ProveedoresModal open={showProvModal} onClose={() => setShowProvModal(false)} proveedores={proveedores} setProveedores={setProveedores} />
      <FamiliasModal
        open={showFamiliasModal}
        onClose={() => setShowFamiliasModal(false)}
        familias={familias}
        addFamilia={addFamilia}
        updateFamilia={updateFamilia}
        deleteFamilia={deleteFamilia}
      />
    </div>
  );
} 