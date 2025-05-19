import React, { useState, useEffect, useRef } from 'react';
import BuscadorProducto from './BuscadorProducto';
import ItemsGrid from './ItemsGrid';

const getStockProveedoresMap = (productos) => {
  const map = {};
  productos.forEach(p => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores;
    }
  });
  return map;
};

const PresupuestoForm = ({
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
  const getDefaultClienteId = (clientes) => {
    const cc = clientes.find(c => (c.razon || c.nombre)?.toLowerCase().includes('cuenta corriente'));
    return cc ? cc.id : '';
  };
  const getDefaultPlazoId = (plazos) => {
    const contado = plazos.find(p => (p.nombre || '').toLowerCase().includes('contado'));
    return contado ? contado.id : '';
  };

  // Normaliza initialData para edición
  function normalizeInitialData(initialData, clientes, productosDisponibles = []) {
    if (!initialData) return initialData;
    let clienteId = initialData.clienteId;
    // Si viene el nombre del cliente, buscar el id
    if (!clienteId && initialData.cliente) {
      const found = clientes.find(c => (c.razon || c.nombre) === initialData.cliente);
      if (found) clienteId = found.id;
    }
    // Si viene como número, convertir a string
    if (clienteId !== undefined && clienteId !== null) clienteId = String(clienteId);
    // Normalizar items
    let items = initialData.items;
    if (!items && initialData.detalle) items = initialData.detalle;
    if (!items && initialData.productos) items = initialData.productos;
    if (!Array.isArray(items)) items = [];
    // Mapear cada item al formato esperado por la grilla
    items = items.map((item, idx) => {
      // Si ya tiene producto, dejarlo
      if (item.producto) return { ...item, id: item.id || idx + 1 };
      // Buscar producto por código si es posible
      let prod = null;
      if (item.codigo || item.codvta) {
        prod = productosDisponibles.find(p => (p.codvta || p.codigo)?.toString() === (item.codigo || item.codvta)?.toString());
      }
      return {
        id: item.id || idx + 1,
        producto: prod || undefined,
        codigo: item.codigo || item.codvta || (prod ? prod.codvta || prod.codigo : ''),
        denominacion: item.denominacion || item.nombre || (prod ? prod.deno || prod.nombre : ''),
        unidad: item.unidad || item.unidadmedida || (prod ? prod.unidad || prod.unidadmedida : ''),
        cantidad: item.cantidad || 1,
        costo: item.costo || item.precio || (prod ? prod.precio || prod.preciovta || prod.preciounitario : 0),
        bonificacion: item.bonificacion || 0,
        subtotal: item.subtotal || 0
      };
    });
    return { ...initialData, clienteId, items };
  }

  // Cargar draft si existe y no es edición
  const [form, setForm] = useState(() => {
    const savedForm = localStorage.getItem('presupuestoFormDraft');
    if (savedForm && !initialData) {
      return JSON.parse(savedForm);
    }
    return normalizeInitialData(initialData, clientes, productos) || {
      numero: '',
      cliente: '',
      clienteId: getDefaultClienteId(clientes),
      plazoId: getDefaultPlazoId(plazos),
      vendedorId: '',
      sucursalId: sucursales[0].id,
      puntoVentaId: puntosVenta[0].id,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Abierto',
      tipo: 'Presupuesto',
      items: [],
      bonificacionGeneral: 0,
      total: 0,
    };
  });

  // Si initialData cambia (por ejemplo, al editar otro presupuesto), actualizo el form
  useEffect(() => {
    if (initialData) {
      setForm(normalizeInitialData(initialData, clientes, productos));
    }
  }, [initialData, clientes, productos]);

  // Guardar en localStorage cuando el formulario cambie (solo si es alta)
  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('presupuestoFormDraft', JSON.stringify(form));
    }
  }, [form, initialData]);

  // Efecto para recalcular totales y aplicar bonificación general
  useEffect(() => {
    let newTotal = 0;
    const updatedItems = form.items.map(item => {
      // Calcular subtotal solo con bonificación particular
      const bonifParticular = parseFloat(item.bonificacion) || 0;
      const subtotal = (parseFloat(item.precio) * parseInt(item.cantidad)) * (1 - bonifParticular / 100);
      newTotal += subtotal;
      return { ...item, subtotal };
    });
    // Solo actualizar si los items o el total realmente cambiaron
    const itemsChanged = JSON.stringify(form.items) !== JSON.stringify(updatedItems);
    if (itemsChanged || form.total !== newTotal) {
      setForm(prevForm => ({
        ...prevForm,
        items: updatedItems,
        total: newTotal * (1 - (parseFloat(form.bonificacionGeneral) || 0) / 100)
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
      // El total se recalculará en el useEffect
    }));
  };

  const numeroComprobante = (() => {
    if (!comprobantes.length) return 1;
    const tipo = tiposComprobante.find(t => t.value === tipoComprobante);
    if (!tipo) return 1;
    return (comprobantes[0][tipo.campo] || 0) + 1;
  })();

  const stockProveedores = getStockProveedoresMap(productos);

  const itemsGridRef = useRef();

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current && typeof itemsGridRef.current.handleAddItem === 'function') {
      itemsGridRef.current.handleAddItem(producto);
    } else if (itemsGridRef.current && typeof itemsGridRef.current.getItems === 'function') {
      // fallback: fuerza un rerender para que la grilla reciba el producto
      itemsGridRef.current.getItems();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    localStorage.removeItem('presupuestoFormDraft');
    // Fuerza estado y tipo
    let impneto = parseFloat(form.total) || 0;
    impneto = Number(impneto.toFixed(2));
    let total = Math.round(impneto);
    const clienteId = form.clienteId || 0;
    const items = itemsGridRef.current.getItems();
    const permitir_stock_negativo = itemsGridRef.current.getStockNegativo();
    const payload = {
      ...form,
      estado: 'Abierto',
      tipo: 'Presupuesto',
      ven_estado: 'AB',
      ven_codcomprob: 4,
      ven_numero: numeroComprobante,
      ven_sucursal: form.sucursalId || 1,
      ven_fecha: form.fecha,
      ven_punto: form.puntoVentaId || 1,
      ven_impneto: impneto,
      ven_descu1: form.descu1 || 0,
      ven_descu2: form.descu2 || 0,
      ven_descu3: form.descu3 || 0,
      ven_total: total,
      ven_vdocomvta: form.vdocomvta || 0,
      ven_vdocomcob: form.vdocomcob || 0,
      ven_idcli: clienteId,
      ven_idpla: form.plazoId,
      ven_idvdo: form.vendedorId,
      ven_copia: form.copia || 1,
      ven_cae: form.cae && form.cae.trim() ? form.cae : '00000000000000',
      items,
      permitir_stock_negativo
    };
    await onSave(payload);
  };

  const handleCancel = () => {
    localStorage.removeItem('presupuestoFormDraft');
    onCancel();
  };

  const isReadOnly = readOnlyOverride || form.estado === 'Cerrado';

  const [editRow, setEditRow] = useState({ codigo: '', cantidad: 1, costo: '', bonificacion: 0 });
  const [selectedProducto, setSelectedProducto] = useState(null);
  const codigoInputRef = useRef();

  return (
    <form className="w-full max-w-6xl mx-auto py-12 px-12 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">{initialData ? (isReadOnly ? 'Ver Presupuesto' : 'Editar Presupuesto') : 'Nuevo Presupuesto'}</h3>
      {isReadOnly && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-600 text-yellow-900 rounded">
          Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Eliminar campo N° Presupuesto si no es editable */}
        {/* <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">N° Presupuesto</label>
          <input name="numero" value={form.numero} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required readOnly />
        </div> */}
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
        <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems del Presupuesto</h4>
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
            modo="presupuesto"
          />
        )}
      </div>

      <div className="mt-8 flex justify-end space-x-3">
        <button type="button" onClick={handleCancel} className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors">{isReadOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!isReadOnly && (
          <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">{initialData ? 'Guardar Cambios' : 'Crear Presupuesto'}</button>
        )}
      </div>
    </form>
  );
};

export default PresupuestoForm; 