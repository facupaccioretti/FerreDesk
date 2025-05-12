import React, { useState, useEffect } from 'react';

const StockForm = ({ stock, onSave, onCancel, proveedores, familias }) => {
  const [formData, setFormData] = useState({
    codvta: '',
    codcom: '',
    deno: '',
    unidad: '',
    cantmin: 0,
    proveedor_habitual_id: '',
    stock_proveedores: [],
    idfam1: null
  });

  const [newStockProve, setNewStockProve] = useState({
    proveedor_id: '',
    cantidad: '',
    costo: ''
  });

  useEffect(() => {
    if (stock) {
      setFormData({
        codvta: stock.codvta || '',
        codcom: stock.codcom || '',
        deno: stock.deno || '',
        unidad: stock.unidad || '',
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id: stock.proveedor_habitual?.id || '',
        stock_proveedores: stock.stock_proveedores || [],
        idfam1: stock.idfam1 || null
      });
    }
  }, [stock]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "idfam1"
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
    
    setFormData(prev => ({
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
    setFormData(prev => ({
      ...prev,
      stock_proveedores: prev.stock_proveedores.filter(sp => sp.proveedor.id !== proveedorId)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Venta</label>
            <input
              type="text"
              name="codvta"
              value={formData.codvta}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código de Compra</label>
            <input
              type="text"
              name="codcom"
              value={formData.codcom}
              onChange={handleInputChange}
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
            value={formData.deno}
            onChange={handleInputChange}
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
              value={formData.unidad}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad Mínima</label>
            <input
              type="number"
              name="cantmin"
              value={formData.cantmin}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Proveedor Habitual</label>
          <select
            name="proveedor_habitual_id"
            value={formData.proveedor_habitual_id}
            onChange={handleInputChange}
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
            value={formData.idfam1 ?? ""}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin familia</option>
            {familias.map(fam => (
              <option key={fam.id} value={fam.id}>
                {fam.deno}
              </option>
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
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Agregar Stock de Proveedor
          </button>

          <div className="mt-4 space-y-2">
            {formData.stock_proveedores.map((sp, index) => (
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
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockForm; 