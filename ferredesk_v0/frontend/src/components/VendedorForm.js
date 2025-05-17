import React, { useState, useEffect } from 'react';

const VendedorForm = ({ initialData = {}, onSave, onCancel, loading, error, localidades = [] }) => {
  const [form, setForm] = useState({
    nombre: '',
    domicilio: '',
    dni: '',
    tel: '',
    comivta: '0',
    liquivta: 'S',
    comicob: '0',
    liquicob: 'S',
    localidad: '',
    activo: 'S',
    ...initialData
  });

  useEffect(() => {
    const sanitizedInitialData = { ...initialData };
    if (typeof sanitizedInitialData.comivta === 'number') {
      sanitizedInitialData.comivta = String(sanitizedInitialData.comivta);
    }
    if (typeof sanitizedInitialData.comicob === 'number') {
      sanitizedInitialData.comicob = String(sanitizedInitialData.comicob);
    }
    setForm(f => ({ ...f, ...sanitizedInitialData }));
  }, [initialData]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const dataToSave = {
        ...form,
        comivta: parseFloat(form.comivta) || 0,
        comicob: parseFloat(form.comicob) || 0,
    };
    onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md w-full max-w-2xl mx-auto">
      <h3 className="text-xl font-bold mb-6">{initialData?.id ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h3>
      {error && <div className="mb-4 text-red-600">Error: {typeof error === 'object' ? JSON.stringify(error) : error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Nombre *</label>
          <input name="nombre" value={form.nombre} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">DNI *</label>
          <input name="dni" value={form.dni} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Domicilio</label>
          <input name="domicilio" value={form.domicilio} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Teléfono</label>
          <input name="tel" value={form.tel} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Comisión Venta (%) *</label>
          <input name="comivta" value={form.comivta} onChange={handleChange} required type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Liquida Comisión Venta *</label>
          <select name="liquivta" value={form.liquivta} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black">
            <option value="S">Sí</option>
            <option value="N">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Comisión Cobranza (%) *</label>
          <input name="comicob" value={form.comicob} onChange={handleChange} required type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Liquida Comisión Cobranza *</label>
          <select name="liquicob" value={form.liquicob} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black">
            <option value="S">Sí</option>
            <option value="N">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Localidad *</label>
          <select name="localidad" value={form.localidad} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black">
            <option value="">Seleccionar localidad...</option>
            {localidades.map(l => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Activo *</label>
          <select name="activo" value={form.activo} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-black focus:border-black">
            <option value="S">Sí</option>
            <option value="N">No</option>
          </select>
        </div>
      </div>
      
      <div className="flex gap-2 mt-8 justify-end">
        <button type="button" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors" disabled={loading}>
          {loading ? 'Guardando...' : (initialData?.id ? 'Guardar Cambios' : 'Crear Vendedor')}
        </button>
      </div>
    </form>
  );
};

export default VendedorForm; 