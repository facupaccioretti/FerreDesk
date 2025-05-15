import React, { useState, useEffect } from 'react';
import { useStockProveAPI } from '../utils/useStockProveAPI';
import { useAlicuotasIVAAPI } from '../utils/useAlicuotasIVAAPI';

const fetchPrecioProveedor = async (proveedorId, codigoProducto) => {
  if (!proveedorId || !codigoProducto) return null;
  try {
    const res = await fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProducto)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.precio || null;
  } catch {
    return null;
  }
};

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
      idfam1: null,
      idfam2: null,
      idfam3: null,
      idaliiva: ''
    };
  });

  const [newStockProve, setNewStockProve] = useState({
    stock: stock?.id || '',
    proveedor: '',
    cantidad: '',
    costo: ''
  });

  const {
    stockProve,
    addStockProve,
    updateStockProve,
    deleteStockProve
  } = useStockProveAPI();

  const { alicuotas } = useAlicuotasIVAAPI();

  const [editingStockProveId, setEditingStockProveId] = useState(null);
  const [editStockProve, setEditStockProve] = useState({ cantidad: '', costo: '' });
  const [formError, setFormError] = useState(null);
  const [precioExcel, setPrecioExcel] = useState(null);
  const [precioExcelError, setPrecioExcelError] = useState('');
  const [permitirCostoManual, setPermitirCostoManual] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (stock) {
      console.log('stock.proveedor_habitual:', stock.proveedor_habitual);
      setForm({
        codvta: stock.codvta || '',
        codcom: stock.codcom || '',
        deno: stock.deno || '',
        unidad: stock.unidad || '',
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id:
          stock.proveedor_habitual && typeof stock.proveedor_habitual === 'object'
            ? String(stock.proveedor_habitual.id)
            : stock.proveedor_habitual && typeof stock.proveedor_habitual === 'string'
              ? stock.proveedor_habitual
              : '',
        idfam1: stock.idfam1 && typeof stock.idfam1 === 'object'
          ? stock.idfam1.id
          : stock.idfam1 ?? null,
        idfam2: stock.idfam2 && typeof stock.idfam2 === 'object'
          ? stock.idfam2.id
          : stock.idfam2 ?? null,
        idfam3: stock.idfam3 && typeof stock.idfam3 === 'object'
          ? stock.idfam3.id
          : stock.idfam3 ?? null,
        idaliiva: stock.idaliiva && typeof stock.idaliiva === 'object'
          ? stock.idaliiva.id
          : stock.idaliiva ?? ''
      });
      setNewStockProve(prev => ({ ...prev, stock: stock.id }));
    }
  }, [stock]);

  useEffect(() => {
    if (!stock) {
      localStorage.setItem('stockFormDraft', JSON.stringify(form));
    }
  }, [form, stock]);

  useEffect(() => {
    if (newStockProve.proveedor && (stock?.codcom || stock?.codvta)) {
      setPrecioExcel(null);
      setPrecioExcelError('');
      setPermitirCostoManual(false);
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${newStockProve.proveedor}&codigo_producto=${encodeURIComponent(stock.codcom || stock.codvta)}`)
        .then(res => res.json())
        .then(data => {
          if (data.precio) {
            setPrecioExcel(data.precio);
            setNewStockProve(prev => ({ ...prev, costo: String(data.precio) }));
            setPrecioExcelError('');
            setPermitirCostoManual(false);
          } else {
            setPrecioExcel(null);
            setPrecioExcelError(data.detail || 'Sin precio en Excel');
            setPermitirCostoManual(true);
          }
        })
        .catch(() => {
          setPrecioExcel(null);
          setPrecioExcelError('Error al consultar precio Excel');
          setPermitirCostoManual(true);
        });
    } else {
      setPrecioExcel(null);
      setPrecioExcelError('');
      setPermitirCostoManual(true);
    }
  }, [newStockProve.proveedor, stock?.codcom, stock?.codvta]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === "proveedor_habitual_id"
        ? value === "" ? '' : String(value)
        : ["idfam1", "idfam2", "idfam3", "idaliiva"].includes(name)
          ? value === "" ? null : Number(value)
          : value
    }));
  };

  const handleNewStockProveChange = (e) => {
    const { name, value } = e.target;
    setNewStockProve(prev => ({
      ...prev,
      [name]: name === "proveedor" ? String(value) : value
    }));
  };

  const addStockProveHandler = async () => {
    if (!newStockProve.proveedor || !newStockProve.cantidad || !newStockProve.costo) {
      alert('Por favor complete todos los campos del proveedor');
      return;
    }
    const proveedorExiste = proveedores.some(p => String(p.id) === String(newStockProve.proveedor));
    if (!proveedorExiste) {
      alert('Debe seleccionar un proveedor válido.');
      return;
    }
    if (!stock?.id) {
      alert('Debe seleccionar un producto válido.');
      return;
    }

    const currentStockId = stock.id;
    const newProveedorId = parseInt(newStockProve.proveedor);
    const newCantidad = parseFloat(newStockProve.cantidad);
    const newCosto = parseFloat(newStockProve.costo);

    console.log('[StockForm] Intentando agregar/actualizar StockProve:');
    console.log('[StockForm] currentStockId (producto):', currentStockId, typeof currentStockId);
    console.log('[StockForm] newProveedorId (proveedor):', newProveedorId, typeof newProveedorId);

    const stockProveForThisStock = stockProve.filter(sp => sp.stock === stock?.id);
    console.log('[StockForm] stockProveForThisStock actual:', JSON.parse(JSON.stringify(stockProveForThisStock)));

    const existingEntry = stockProveForThisStock.find(sp => {
      const spStock = sp.stock;
      const spProveedorId = sp.proveedor?.id || sp.proveedor;
      console.log(`[StockForm] Comparando: sp.stock (${spStock}, ${typeof spStock}) === currentStockId (${currentStockId}, ${typeof currentStockId}) AND sp.proveedor (${spProveedorId}, ${typeof spProveedorId}) === newProveedorId (${newProveedorId}, ${typeof newProveedorId})`);
      const match = spStock === currentStockId && spProveedorId === newProveedorId;
      if (match) console.log('[StockForm] ENCONTRADO existingEntry:', sp);
      return match;
    });

    if (!existingEntry) {
      console.log('[StockForm] No se encontró existingEntry. Se intentará CREAR.');
    }

    try {
      if (existingEntry) {
        // Actualizar entrada existente
        const updatedCantidad = parseFloat(existingEntry.cantidad) + newCantidad;
        console.log('[StockForm] Actualizando existingEntry:', existingEntry);
        const stockIdForUpdate = existingEntry.stock; // ID del producto (Stock)
        const proveedorIdForUpdate = existingEntry.proveedor?.id || existingEntry.proveedor; // ID del proveedor

        if (!stockIdForUpdate || !proveedorIdForUpdate) {
          console.error('[StockForm] Faltan stockId o proveedorId para la actualización:', existingEntry);
          alert('Error: No se pudo determinar el producto o proveedor para actualizar.');
          return;
        }

        await updateStockProve(existingEntry.id, {
          stockId: stockIdForUpdate,
          proveedorId: proveedorIdForUpdate,
          cantidad: updatedCantidad,
          costo: newCosto
        });
        setRefresh(r => r + 1);
        console.log('Stock-Proveedor actualizado con ID:', existingEntry.id);
      } else {
        // Agregar nueva entrada
        await addStockProve({
          stock: currentStockId,
          proveedor_id: newProveedorId,
          cantidad: newCantidad,
          costo: newCosto
        });
        // Si es el primer proveedor para este producto (después de esta adición), setearlo como habitual
        if (stockProveForThisStock.length === 0) { // Chequea antes de que se actualice la lista localmente por el hook
          setForm(prev => ({ ...prev, proveedor_habitual_id: String(newProveedorId) }));
        }
        setRefresh(r => r + 1);
        console.log('Nuevo Stock-Proveedor agregado');
      }
      setNewStockProve({ stock: currentStockId, proveedor: '', cantidad: '', costo: '' });
      // Resetear el estado de costo manual y precio excel para la próxima entrada
      setPrecioExcel(null);
      setPrecioExcelError('');
      setPermitirCostoManual(false);
    } catch (err) {
      alert('Error al procesar stock de proveedor: ' + (err.response?.data?.non_field_errors?.[0] || err.message || 'Error desconocido'));
      // Considerar no resetear el formulario aquí para que el usuario pueda corregir
    }
  };

  const removeStockProveHandler = async (id) => {
    // Si el que se elimina es el proveedor habitual, limpiar o reasignar
    const sp = stockProveForThisStock.find(sp => sp.id === id);
    const habitualId = form.proveedor_habitual_id;
    await deleteStockProve(id);
    if (sp && String(sp.proveedor?.id || sp.proveedor) === String(habitualId)) {
      // Buscar otro proveedor asociado, si hay
      const restantes = stockProveForThisStock.filter(sp2 => sp2.id !== id);
      if (restantes.length > 0) {
        const nuevoHabitual = restantes[0].proveedor?.id || restantes[0].proveedor;
        setForm(prev => ({ ...prev, proveedor_habitual_id: String(nuevoHabitual) }));
      } else {
        setForm(prev => ({ ...prev, proveedor_habitual_id: '' }));
      }
    }
    setRefresh(r => r + 1);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    localStorage.removeItem('stockFormDraft');
    setFormError(null);
    try {
      await onSave(form);
    } catch (err) {
      setFormError(err.message || 'Error al guardar el producto');
      return;
    }
  };

  const handleCancel = () => {
    localStorage.removeItem('stockFormDraft');
    onCancel();
  };

  // Filtra los stockProve de este producto
  const stockProveForThisStock = stockProve.filter(sp => sp.stock === stock?.id);

  const handleEditStockProve = (sp) => {
    setEditingStockProveId(sp.id);
    setEditStockProve({ cantidad: sp.cantidad, costo: sp.costo });
  };

  const handleEditStockProveCancel = () => {
    setEditingStockProveId(null);
    setEditStockProve({ cantidad: '', costo: '' });
  };

  const handleEditStockProveSave = async (id) => {
    await updateStockProve(id, {
      cantidad: parseFloat(editStockProve.cantidad),
      costo: parseFloat(editStockProve.costo),
    });
    setEditingStockProveId(null);
    setEditStockProve({ cantidad: '', costo: '' });
  };

  console.log('form state:', JSON.stringify(form));
  console.log('select value:', form.proveedor_habitual_id);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSave} className="space-y-6">
        {formError && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 border border-red-300">
            {formError}
          </div>
        )}
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
            value={form.proveedor_habitual_id ?? ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Seleccione un proveedor</option>
            {stockProveForThisStock.map(sp => {
              const proveedor = typeof sp.proveedor === 'object' ? sp.proveedor : proveedores.find(p => p.id === sp.proveedor);
              return proveedor ? (
                <option key={proveedor.id} value={String(proveedor.id)}>
                  {proveedor.razon}
                </option>
              ) : null;
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Familia</label>
          <select
            name="idfam1"
            value={typeof form.idfam1 === 'number' || typeof form.idfam1 === 'string' ? form.idfam1 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin familia</option>
            {familias.filter(fam => String(fam.nivel) === '1').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Subfamilia</label>
          <select
            name="idfam2"
            value={typeof form.idfam2 === 'number' || typeof form.idfam2 === 'string' ? form.idfam2 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin subfamilia</option>
            {familias.filter(fam => String(fam.nivel) === '2').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sub-subfamilia</label>
          <select
            name="idfam3"
            value={typeof form.idfam3 === 'number' || typeof form.idfam3 === 'string' ? form.idfam3 : ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Sin sub-subfamilia</option>
            {familias.filter(fam => String(fam.nivel) === '3').map(fam => (
              <option key={fam.id} value={fam.id}>{fam.deno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Alicuota de IVA</label>
          <select
            name="idaliiva"
            value={typeof form.idaliiva === 'number' || typeof form.idaliiva === 'string' ? form.idaliiva : ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          >
            <option value="">Seleccione una alícuota</option>
            {alicuotas.map(a => (
              <option key={a.id} value={a.id}>{a.deno} ({a.porce}%)</option>
            ))}
          </select>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stock por Proveedor</h3>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <select
              name="proveedor"
              value={typeof newStockProve.proveedor === 'string' || typeof newStockProve.proveedor === 'number' ? newStockProve.proveedor : ''}
              onChange={handleNewStockProveChange}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione un proveedor</option>
              {proveedores.map(proveedor => (
                <option key={proveedor.id} value={String(proveedor.id)}>
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
            <div className="relative">
              <input
                type="number"
                name="costo"
                value={newStockProve.costo}
                onChange={handleNewStockProveChange}
                placeholder="Costo"
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 w-full pr-10"
                disabled={!permitirCostoManual && precioExcel !== null}
              />
            </div>
          </div>
          {newStockProve.proveedor && (
            <div className="mb-2 text-sm">
              {precioExcel !== null ? (
                <div className="flex items-center">
                  <span className="text-blue-700">Precio Excel: ${precioExcel}</span>
                  {!permitirCostoManual && (
                    <button
                      type="button"
                      onClick={() => setPermitirCostoManual(true)}
                      className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
                    >
                      Ingresar manualmente
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-red-600">{precioExcelError || "No se detectó precio en Excel."}</span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={addStockProveHandler}
            className="mb-4 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          >
            Agregar Stock de Proveedor
          </button>
          <div className="mt-4 space-y-2">
            {stockProveForThisStock.map((sp, index) => (
              <div key={sp.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">
                      {typeof sp.proveedor === 'object'
                        ? sp.proveedor.razon
                        : proveedores.find(p => p.id === sp.proveedor)?.razon || sp.proveedor}
                    </span>
                    <span className="text-sm text-gray-500">
                      Cantidad: {editingStockProveId === sp.id ? (
                        <input
                          type="number"
                          value={editStockProve.cantidad}
                          onChange={e => setEditStockProve(prev => ({ ...prev, cantidad: e.target.value }))}
                          className="w-20 border rounded px-1 py-0.5 text-sm"
                        />
                      ) : sp.cantidad}
                      {' | '}Costo: {editingStockProveId === sp.id ? (
                        <input
                          type="number"
                          value={editStockProve.costo}
                          onChange={e => setEditStockProve(prev => ({ ...prev, costo: e.target.value }))}
                          className="w-20 border rounded px-1 py-0.5 text-sm"
                        />
                      ) : `$${sp.costo}`}
                      {' | '}<PrecioExcelProveedor proveedorId={sp.proveedor?.id || sp.proveedor} codigoProducto={stock.codcom || stock.codvta} />
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {editingStockProveId === sp.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditStockProveSave(sp.id)}
                          className="text-green-600 hover:text-green-900 text-sm"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={handleEditStockProveCancel}
                          className="text-gray-600 hover:text-gray-900 text-sm"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditStockProve(sp)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStockProveHandler(sp.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
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

// Componente auxiliar para mostrar el precio Excel de cada proveedor asociado
function PrecioExcelProveedor({ proveedorId, codigoProducto }) {
  const [precio, setPrecio] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (proveedorId && codigoProducto) {
      fetch(`/api/productos/precio-producto-proveedor/?proveedor_id=${proveedorId}&codigo_producto=${encodeURIComponent(codigoProducto)}`)
        .then(res => res.json())
        .then(data => {
          if (data.precio) {
            setPrecio(data.precio);
            setError('');
          } else {
            setPrecio(null);
            setError(data.detail || 'Sin precio Excel');
          }
        })
        .catch(() => {
          setPrecio(null);
          setError('Error al consultar precio Excel');
        });
    } else {
      setPrecio(null);
      setError('');
    }
  }, [proveedorId, codigoProducto]);
  if (precio !== null) return <span className="ml-2 text-blue-700">Precio Excel: ${precio}</span>;
  if (error) return <span className="ml-2 text-red-600">{error}</span>;
  return null;
}

export default StockForm; 