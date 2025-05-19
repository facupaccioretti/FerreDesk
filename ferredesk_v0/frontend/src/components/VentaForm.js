import React, { useState, useEffect, useRef } from 'react';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from './BuscadorProducto';

const getInitialFormState = (sucursales = [], puntosVenta = []) => ({
  numero: '',
  cliente: '',
  clienteId: '',
  plazoId: '',
  vendedorId: '',
  sucursalId: sucursales[0]?.id || '',
  puntoVentaId: puntosVenta[0]?.id || '',
  fecha: new Date().toISOString().split('T')[0],
  estado: 'Abierto',
  tipo: 'Venta',
  items: [],
  bonificacionGeneral: 0,
  total: 0,
  descu1: 0,
  descu2: 0,
  descu3: 0,
  copia: 1,
  cae: '',
});

const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => {
  const defaults = getInitialFormState(sucursales, puntosVenta);
  return { ...defaults, ...data };
};

const getDefaultClienteId = (clientes) => {
  const cc = clientes.find(c => (c.razon || c.nombre)?.toLowerCase().includes('cuenta corriente'));
  return cc ? cc.id : '';
};
const getDefaultPlazoId = (plazos) => {
  const contado = plazos.find(p => (p.nombre || '').toLowerCase().includes('contado'));
  return contado ? contado.id : '';
};

const getStockProveedoresMap = (productos) => {
  const map = {};
  productos.forEach(p => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores;
    }
  });
  return map;
};

const VentaForm = ({
  onSave,
  onCancel,
  initialData,
  readOnlyOverride,
  comprobantes,
  tiposComprobante,
  tipoComprobante,
  setTipoComprobante,
  clientes,
  plazos,
  vendedores,
  sucursales,
  puntosVenta,
  loadingComprobantes,
  errorComprobantes,
  productos,
  loadingProductos,
  familias,
  loadingFamilias,
  proveedores,
  loadingProveedores,
  alicuotas,
  loadingAlicuotas,
  errorProductos,
  errorFamilias,
  errorProveedores,
  errorAlicuotas,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  ItemsGrid
}) => {
  const [form, setForm] = useState(() => {
    const savedForm = localStorage.getItem('ventaFormDraft');
    if (savedForm && !initialData) {
      try {
        const parsed = JSON.parse(savedForm);
        const items = parsed.items.map(item => {
          const bonifParticular = parseFloat(item.bonificacion) || 0;
          const subtotal = (parseFloat(item.precio) * parseInt(item.cantidad)) * (1 - bonifParticular / 100);
          return { ...item, subtotal };
        });
        return mergeWithDefaults({ ...parsed, items }, sucursales, puntosVenta);
      } catch (e) {
        console.error('Error al cargar formulario guardado:', e);
        return getInitialFormState(sucursales, puntosVenta);
      }
    }
    return mergeWithDefaults(initialData || {
      clienteId: getDefaultClienteId(clientes),
      plazoId: getDefaultPlazoId(plazos),
      vendedorId: '',
    }, sucursales, puntosVenta);
  });

  const [editRow, setEditRow] = useState({ codigo: '', cantidad: 1, costo: '', bonificacion: 0 });
  const [selectedProducto, setSelectedProducto] = useState(null);
  const codigoInputRef = useRef();
  const itemsGridRef = useRef();

  const stockProveedores = getStockProveedoresMap(productos);

  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('ventaFormDraft', JSON.stringify(form));
    }
  }, [form, initialData]);

  useEffect(() => {
    let newTotal = 0;
    const updatedItems = form.items.map(item => {
      const bonifParticular = parseFloat(item.bonificacion) || 0;
      const cantidad = parseInt(item.cantidad) || 0;
      const precio = parseFloat(item.precio) || 0;
      const subtotal = (precio * cantidad) * (1 - bonifParticular / 100);
      newTotal += subtotal;
      return { ...item, subtotal };
    });

    const itemsChanged = JSON.stringify(form.items) !== JSON.stringify(updatedItems);
    const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
    const totalConBonif = Math.round((newTotal * (1 - bonifGeneral / 100)) * 100) / 100;

    if (itemsChanged || form.total !== totalConBonif) {
      setForm(prevForm => ({
        ...prevForm,
        items: updatedItems,
        total: totalConBonif,
        ven_impneto: totalConBonif.toFixed(2), // Asegurar 2 decimales
        ven_total: Math.round(totalConBonif) // Redondear a entero para ven_total
      }));
    }
  }, [form.bonificacionGeneral, form.items]);

  const handleChange = e => {
    const { name, value, type } = e.target;
    setForm(prevForm => ({
      ...prevForm,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleAddItem = (item) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...item, precio: item.costo, bonificacion: item.bonificacion || 0 }],
    }));
  };

  const handleEditItem = (id, updatedItem) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...updatedItem, precio: updatedItem.costo, bonificacion: updatedItem.bonificacion || 0 } : item),
    }));
  };

  const handleDeleteItem = (id) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  };

  const numeroComprobante = (() => {
    if (!comprobantes.length) return 1;
    const tipo = tiposComprobante.find(t => t.value === tipoComprobante);
    if (!tipo) return 1;
    return (comprobantes[0][tipo.campo] || 0) + 1;
  })();

  const isReadOnly = readOnlyOverride || form.estado === 'Cerrado';

  const handleSubmit = async (e) => {
    e.preventDefault();
    localStorage.removeItem('ventaFormDraft');
    // Fuerza estado y tipo
    const items = itemsGridRef.current.getItems();
    const permitir_stock_negativo = itemsGridRef.current.getStockNegativo();
    const payload = {
      ...form,
      estado: 'Cerrado',
      tipo: 'Venta',
      ven_estado: 'CE',
      ven_codcomprob: 1,
      ven_numero: form.numero,
      ven_sucursal: form.sucursalId || 1,
      ven_fecha: form.fecha,
      items,
      permitir_stock_negativo
    };
    await onSave(payload);
  };

  const handleCancel = () => {
    if (window.confirm('¿Está seguro que desea cancelar? Se perderán los cambios no guardados.')) {
      localStorage.removeItem('ventaFormDraft');
      onCancel();
    }
  };

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current && itemsGridRef.current.handleAddItem) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  return (
    <form className="w-full max-w-6xl mx-auto py-12 px-12 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">{initialData ? (isReadOnly ? 'Ver Venta' : 'Editar Venta') : 'Nueva Venta'}</h3>
      {isReadOnly && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-600 text-yellow-900 rounded">
          Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">N° Venta</label>
          <input name="numero" value={form.numero} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required readOnly={isReadOnly} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Cliente *</label>
          <select
            name="clienteId"
            value={form.clienteId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar cliente...</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razon || c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Fecha</label>
          <input name="fecha" type="date" value={form.fecha} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required readOnly={isReadOnly} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Total</label>
          <input type="text" value={`$${(form.total || 0).toFixed(2)}`} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Plazo *</label>
          <select
            name="plazoId"
            value={form.plazoId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar plazo...</option>
            {plazos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Vendedor *</label>
          <select
            name="vendedorId"
            value={form.vendedorId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar vendedor...</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Sucursal *</label>
          <select
            name="sucursalId"
            value={form.sucursalId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={isReadOnly}
          >
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Punto de Venta *</label>
          <select
            name="puntoVentaId"
            value={form.puntoVentaId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={isReadOnly}
          >
            {puntosVenta.map(pv => (
              <option key={pv.id} value={pv.id}>{pv.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingComprobantes && <div className="mb-2 text-gray-500">Cargando tipos de comprobante...</div>}
      {errorComprobantes && <div className="mb-2 text-red-600">{errorComprobantes}</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-500 mb-1">Tipo de Comprobante *</label>
        <select
          name="tipoComprobante"
          value={tipoComprobante}
          onChange={e => setTipoComprobante(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          required
          disabled={isReadOnly}
        >
          {tiposComprobante.map(tc => (
            <option key={tc.value} value={tc.value}>{tc.label}</option>
          ))}
        </select>
      </div>

      {comprobantes.length > 0 && (
        <div className="mb-4">
          Próximo número:&nbsp;
          {
            (() => {
              const tipo = tiposComprobante.find(t => t.value === tipoComprobante);
              if (!tipo) return 1;
              return (comprobantes[0][tipo.campo] || 0) + 1;
            })()
          }
        </div>
      )}

      <div className="mb-4 flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-700">Acción por defecto al cargar ítem duplicado:</label>
        <select value={autoSumarDuplicados} onChange={e => setAutoSumarDuplicados(e.target.value)} className="px-2 py-1 border rounded">
          <option value="sumar">Sumar cantidades</option>
          <option value="duplicar">Crear duplicado</option>
        </select>
        <span className="text-xs text-gray-500 ml-2">Se resaltarán en rojo los duplicados.</span>
      </div>

      <div className="mb-8">
        <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems de la Venta</h4>
        <BuscadorProducto
          productos={productos}
          onSelect={handleAddItemToGrid}
        />
        {(loadingProductos || loadingFamilias || loadingProveedores || loadingAlicuotas) ? (
          <div className="text-center text-gray-500 py-4">Cargando productos, familias, proveedores y alícuotas...</div>
        ) : errorProductos ? (
          <div className="text-center text-red-600 py-4">{errorProductos}</div>
        ) : errorFamilias ? (
          <div className="text-center text-red-600 py-4">{errorFamilias}</div>
        ) : errorProveedores ? (
          <div className="text-center text-red-600 py-4">{errorProveedores}</div>
        ) : errorAlicuotas ? (
          <div className="text-center text-red-600 py-4">{errorAlicuotas}</div>
        ) : (
          <ItemsGrid
            ref={itemsGridRef}
            productosDisponibles={productos}
            proveedores={proveedores}
            stockProveedores={stockProveedores}
            autoSumarDuplicados={autoSumarDuplicados}
            setAutoSumarDuplicados={setAutoSumarDuplicados}
            bonificacionGeneral={form.bonificacionGeneral}
            setBonificacionGeneral={value => setForm(f => ({ ...f, bonificacionGeneral: value }))}
            modo="venta"
          />
        )}
      </div>

      <div className="mt-8 flex justify-end space-x-3">
        <button type="button" onClick={handleCancel} className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors">{isReadOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!isReadOnly && (
          <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">{initialData ? 'Guardar Cambios' : 'Crear Venta'}</button>
        )}
      </div>
    </form>
  );
};

export default VentaForm; 