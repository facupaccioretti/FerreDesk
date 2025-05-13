import React, { useState, useEffect } from 'react';

const StockForm = ({ stock, onSave, onCancel, proveedores, familias }) => {
  const [form, setForm] = useState(() => {
    const savedForm = localStorage.getItem('stockFormDraft');
    if (savedForm && !stock) {
      return JSON.parse(savedForm);
    }
    return stock || {
      codvta: '',
      codcom: '',
      deno: '',
      unidad: '',
      cantmin: 0,
      proveedor_habitual_id: '',
      stock_proveedores: [],
      idfam1: null,
      idfam2: null,
      idfam3: null
    };
  });

  const [newStockProve, setNewStockProve] = useState({
    proveedor_id: '',
    cantidad: '',
    costo: ''
  });

  useEffect(() => {
    if (stock) {
      setForm({
        codvta: stock.codvta || '',
        codcom: stock.codcom || '',
        deno: stock.deno || '',
        unidad: stock.unidad || '',
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id: stock.proveedor_habitual?.id || '',
        stock_proveedores: stock.stock_proveedores || [],
        idfam1: stock.idfam1 || null,
        idfam2: stock.idfam2 || null,
        idfam3: stock.idfam3 || null
      });
    }
  }, [stock]);

  useEffect(() => {
    if (!stock) {
      localStorage.setItem('stockFormDraft', JSON.stringify(form));
    }
  }, [form, stock]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: ["idfam1", "idfam2", "idfam3"].includes(name)
        ? value === "" ? null : Number(value)
        : value
    }));
  };

  const handleNewStockProveChange = (e) => {
    const { name, value } = e.target;
    setNewStockProve(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addStockProve = () => {
    if (!newStockProve.proveedor_id || !newStockProve.cantidad || !newStockProve.costo) {
      alert('Por favor complete todos los campos del proveedor');
      return;
    }

    const proveedor = proveedores.find(p => p.id === parseInt(newStockProve.proveedor_id));
    
    setForm(prev => ({
      ...prev,
      stock_proveedores: [
        ...prev.stock_proveedores,
        {
          proveedor_id: parseInt(newStockProve.proveedor_id),
          proveedor: proveedor,
          cantidad: parseFloat(newStockProve.cantidad),
          costo: parseFloat(newStockProve.costo)
        }
      ]
    }));

    setNewStockProve({
      proveedor_id: '',
      cantidad: '',
      costo: ''
    });
  };

  const removeStockProve = (proveedorId) => {
    setForm(prev => ({
      ...prev,
      stock_proveedores: prev.stock_proveedores.filter(sp => sp.proveedor.id !== proveedorId)
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.removeItem('stockFormDraft');
    onSave(form);
  };

  const handleCancel = () => {
    localStorage.removeItem('stockFormDraft');
    onCancel();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Venta</label>
            <input
              type="text"
              name="codvta"
              value={form.codvta}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Compra</label>
            <input
              type="text"
              name="codcom"
              value={form.codcom}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Denominación</label>
          <input
            type="text"
            name="deno"
            value={form.deno}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Unidad</label>
            <input
              type="text"
              name="unidad"
              value={form.unidad}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad Mínima</label>
            <input
              type="number"
              name="cantmin"
              value={form.cantmin}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Proveedor Habitual</label>
          <select
            name="proveedor_habitual_id"
            value={form.proveedor_habitual_id}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Seleccione un proveedor</option>
            {proveedores.map(proveedor => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.razon}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Familia</label>
          <select
            name="idfam1"
            value={form.idfam1 ?? ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin familia</option>
            {familias.filter(fam => fam.nivel === '1').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Subfamilia</label>
          <select
            name="idfam2"
            value={form.idfam2 ?? ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin subfamilia</option>
            {familias.filter(fam => fam.nivel === '2').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sub-subfamilia</label>
          <select
            name="idfam3"
            value={form.idfam3 ?? ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin sub-subfamilia</option>
            {familias.filter(fam => fam.nivel === '3').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stock por Proveedor</h3>
          
          <div className="mb-4 grid grid-cols-3 gap-4">
            <select
              name="proveedor_id"
              value={newStockProve.proveedor_id}
              onChange={handleNewStockProveChange}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione un proveedor</option>
              {proveedores.map(proveedor => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.razon}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="cantidad"
              value={newStockProve.cantidad}
              onChange={handleNewStockProveChange}
              placeholder="Cantidad"
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <input
              type="number"
              name="costo"
              value={newStockProve.costo}
              onChange={handleNewStockProveChange}
              placeholder="Costo"
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <button
            type="button"
            onClick={addStockProve}
            className="mb-4 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          >
            Agregar Stock de Proveedor
          </button>

          <div className="mt-4 space-y-2">
            {form.stock_proveedores.map((sp, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">{sp.proveedor.razon}</span>
                    <span className="text-sm text-gray-500">
                      Cantidad: {sp.cantidad} | Costo: ${sp.costo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStockProve(sp.proveedor.id)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          >
            {stock ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockForm; 