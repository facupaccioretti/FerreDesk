import React, { useState, useEffect, useRef } from 'react';
import BuscadorProducto from './BuscadorProducto';
import { ItemsGridEdicion } from './ItemsGrid';
import ComprobanteDropdown from './ComprobanteDropdown';

const getStockProveedoresMap = (productos) => {
  const map = {};
  productos.forEach(p => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores;
    }
  });
  return map;
};

// Muevo getInitialFormState arriba para que esté definida antes de mergeWithDefaults
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
  tipo: 'Presupuesto',
  items: [],
  bonificacionGeneral: 0,
  total: 0,
  descu1: 0,
  descu2: 0,
  descu3: 0,
  copia: 1,
  ven_impneto: 0,
  ven_total: 0,
  ven_vdocomvta: 0,
  ven_vdocomcob: 0,
  ven_idcli: '',
  ven_idpla: '',
  ven_idvdo: '',
  ven_copia: 1
});

// Agrego la función mergeWithDefaults
const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => {
  const defaults = getInitialFormState(sucursales, puntosVenta);
  return { ...defaults, ...data };
};

const EditarPresupuestoForm = ({
  onSave,
  onCancel,
  initialData,
  comprobantes,
  tiposComprobante,
  tipoComprobante,
  setTipoComprobante,
  clientes,
  plazos,
  vendedores,
  sucursales,
  puntosVenta,
  productos,
  proveedores,
  alicuotas,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  loadingProductos,
  loadingFamilias,
  loadingProveedores,
  loadingAlicuotas,
  errorProductos,
  errorFamilias,
  errorProveedores,
  errorAlicuotas
}) => {
  // Normaliza initialData para edición
  function normalizeInitialData(initialData, clientes, productosDisponibles = []) {
    if (!initialData) return initialData;
    let clienteId = initialData.clienteId;
    if (!clienteId && initialData.cliente) {
      const found = clientes.find(c => (c.razon || c.nombre) === initialData.cliente);
      if (found) clienteId = found.id;
    }
    if (clienteId !== undefined && clienteId !== null) clienteId = String(clienteId);
    let items = initialData.items;
    if (!items && initialData.detalle) items = initialData.detalle;
    if (!items && initialData.productos) items = initialData.productos;
    if (!Array.isArray(items)) items = [];
    items = items.map((item, idx) => {
      let prod = item.producto || productosDisponibles.find(p => p.id === (item.vdi_idsto || item.idSto || item.idsto || item.id));
      return {
        id: item.id || idx + 1,
        producto: prod,
        codigo: item.codigo || prod?.codvta || prod?.codigo || '',
        denominacion: item.denominacion || prod?.deno || prod?.nombre || '',
        unidad: item.unidad || prod?.unidad || prod?.unidadmedida || '-',
        cantidad: item.cantidad || item.vdi_cantidad || 1,
        costo: item.costo || item.precio || item.vdi_importe || 0,
        bonificacion: item.bonificacion || item.vdi_bonifica || 0,
        proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || '',
      };
    });
    return { ...initialData, clienteId, items };
  }

  // Actualizar el estado inicial del form
  const [form, setForm] = useState(() => {
    console.log('EditarPresupuestoForm: initialData al cargar', initialData);
    let normalized = mergeWithDefaults(normalizeInitialData(initialData, clientes, productos), sucursales, puntosVenta);
    // Usar solo el valor entero de ven_numero
    let numero = initialData?.ven_numero;
    if (initialData && typeof numero === 'number') {
      normalized.numero = numero;
    } else if (initialData && typeof numero === 'string' && !isNaN(Number(numero))) {
      normalized.numero = Number(numero);
    }
    return normalized;
  });

  // Si initialData cambia (por ejemplo, al editar otro presupuesto), actualizo el form
  useEffect(() => {
    if (initialData) {
      let normalized = mergeWithDefaults(normalizeInitialData(initialData, clientes, productos), sucursales, puntosVenta);
      let numero = initialData?.ven_numero;
      if (typeof numero === 'number') {
        normalized.numero = numero;
      } else if (typeof numero === 'string' && !isNaN(Number(numero))) {
        normalized.numero = Number(numero);
      }
      setForm(normalized);
    }
  }, [initialData, clientes, productos, sucursales, puntosVenta]);

  // Estado para descuentos
  const [descu1, setDescu1] = useState(form.descu1 || 0);
  const [descu2, setDescu2] = useState(form.descu2 || 0);
  const [itemsVersion, setItemsVersion] = useState(0);

  // Estado de los ítems vive en el padre
  const [items, setItems] = useState(() => {
    if (initialData && Array.isArray(initialData.items)) return initialData.items;
    if (initialData && Array.isArray(initialData.detalle)) return initialData.detalle;
    return [];
  });

  // Cuando initialData cambia, actualizar los ítems
  useEffect(() => {
    if (initialData && Array.isArray(initialData.items)) setItems(initialData.items);
    else if (initialData && Array.isArray(initialData.detalle)) setItems(initialData.detalle);
    else setItems([]);
  }, [initialData]);

  // Handler para cambios en la grilla
  const handleRowsChange = (rows) => {
    setItems(rows);
  };

  // handleAddItem y handleEditItem ya no son necesarios aquí

  // Forzar comprobante 9997 para presupuesto
  const comprobanteId = 9997;

  const stockProveedores = getStockProveedoresMap(productos);

  const itemsGridRef = useRef();

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    console.log('[EditarPresupuestoForm] handleAddItemToGrid llamado con:', producto);
    if (itemsGridRef.current && typeof itemsGridRef.current.handleAddItem === 'function') {
      itemsGridRef.current.handleAddItem(producto);
      console.log('[EditarPresupuestoForm] handleAddItem ejecutado en ref');
    } else {
      console.error('[EditarPresupuestoForm] itemsGridRef.current o handleAddItem no está disponible', itemsGridRef.current);
    }
  };

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Copio la función de mapeo de campos de items de Venta
  const mapItemFields = (item, idx) => {
    return {
      vdi_orden: idx + 1,
      vdi_idsto: item.producto?.id ?? item.idSto ?? item.vdi_idsto ?? item.idsto ?? null,
      vdi_idpro: item.proveedorId ?? item.idPro ?? item.vdi_idpro ?? null,
      vdi_cantidad: item.cantidad ?? item.vdi_cantidad ?? 1,
      vdi_importe: item.costo ?? item.precio ?? item.importe ?? item.vdi_importe ?? 0,
      vdi_bonifica: item.bonificacion ?? item.bonifica ?? item.vdi_bonifica ?? 0,
      vdi_detalle1: item.denominacion ?? item.detalle1 ?? item.vdi_detalle1 ?? '',
      vdi_detalle2: item.detalle2 ?? item.vdi_detalle2 ?? '',
      vdi_idaliiva: item.producto?.idaliiva ?? item.alicuotaIva ?? item.vdi_idaliiva ?? null,
    };
  };

  // Asegurar valor por defecto para autoSumarDuplicados
  useEffect(() => {
    if (!autoSumarDuplicados) setAutoSumarDuplicados('sumar');
  }, [autoSumarDuplicados, setAutoSumarDuplicados]);

  const handleSubmit = async (e) => {
    console.log('handleSubmit: inicio');
    e.preventDefault();
    // Obtengo los items actuales desde el ref
    const items = itemsGridRef.current ? itemsGridRef.current.getItems() : [];
    console.log('handleSubmit: items obtenidos para guardar:', items.map(item => ({
      vdi_idsto: item.producto?.id ?? item.idSto ?? item.vdi_idsto ?? item.idsto ?? null,
      vdi_idpro: item.proveedorId ?? item.idPro ?? item.vdi_idpro ?? null,
      cantidad: item.cantidad,
      costo: item.costo,
      bonificacion: item.bonificacion,
      codigo: item.codigo,
      producto: item.producto,
      proveedorId: item.proveedorId
    })));
    if (!items || items.length === 0) {
      console.error('handleSubmit: Debe agregar al menos un ítem válido al presupuesto');
      setError('Debe agregar al menos un ítem válido al presupuesto');
      return;
    }
    for (const item of items) {
      if (!item.vdi_idsto && !(item.producto && item.producto.id)) {
        setError('Todos los ítems deben tener producto y proveedor válidos.');
        console.error('handleSubmit: item inválido', item);
        return;
      }
    }
    try {
      setIsLoading(true);
      setError(null);
      let payload;
      if (initialData && initialData.id) {
        const mappedItems = items.map(mapItemFields);
        payload = {
          ven_id: parseInt(initialData.id),
          ven_estado: 'AB',
          ven_tipo: 'Presupuesto',
          tipo_comprobante: 'presupuesto',
          comprobante: parseInt(form.comprobante) || parseInt(form.comprobanteId) || '',
          ven_numero: Number(form.numero) || 1,
          ven_sucursal: parseInt(form.sucursalId, 10) || 1,
          ven_fecha: form.fecha,
          ven_punto: parseInt(form.puntoVentaId, 10) || 1,
          ven_impneto: parseFloat(form.ven_impneto) || 0,
          ven_descu1: parseFloat(descu1) || 0,
          ven_descu2: parseFloat(descu2) || 0,
          ven_descu3: parseFloat(form.descu3) || 0,
          bonificacionGeneral: parseFloat(form.bonificacionGeneral) || 0,
          ven_bonificacion_general: parseFloat(form.bonificacionGeneral) || 0,
          ven_total: parseFloat(form.ven_total) || 0,
          ven_vdocomvta: parseFloat(form.ven_vdocomvta) || 0,
          ven_vdocomcob: parseFloat(form.ven_vdocomcob) || 0,
          ven_idcli: parseInt(form.clienteId) || '',
          ven_idpla: parseInt(form.plazoId) || '',
          ven_idvdo: parseInt(form.vendedorId) || '',
          ven_copia: parseInt(form.copia, 10) || 1,
          items: mappedItems,
          permitir_stock_negativo: true,
          update_atomic: true
        };
        console.log('handleSubmit: payload de edición', payload);
      } else {
        payload = {
          ven_estado: 'AB',
          ven_tipo: 'Presupuesto',
          tipo_comprobante: 'presupuesto',
          comprobante: comprobanteId,
          ven_numero: form.numero || 1,
          ven_sucursal: form.sucursalId || 1,
          ven_fecha: form.fecha,
          ven_punto: form.puntoVentaId || 1,
          ven_impneto: form.ven_impneto || 0,
          ven_descu1: descu1 || 0,
          ven_descu2: descu2 || 0,
          ven_descu3: form.descu3 || 0,
          bonificacionGeneral: form.bonificacionGeneral || 0,
          ven_bonificacion_general: form.bonificacionGeneral || 0,
          ven_total: form.ven_total || 0,
          ven_vdocomvta: form.ven_vdocomvta || 0,
          ven_vdocomcob: form.ven_vdocomcob || 0,
          ven_idcli: form.clienteId,
          ven_idpla: form.plazoId,
          ven_idvdo: form.vendedorId,
          ven_copia: form.copia || 1,
          items: items.map(mapItemFields),
          permitir_stock_negativo: true,
          update_atomic: true
        };
      }
      console.log('handleSubmit: llamando a onSave');
      const onSaveResult = await onSave(payload);
      console.log('handleSubmit: respuesta de onSave', onSaveResult);
      console.log('handleSubmit: onSave completado');
      onCancel();
      console.log('handleSubmit: onCancel ejecutado');
    } catch (err) {
      setError(err.message || 'Error al guardar el presupuesto');
      console.error('handleSubmit: ERROR al guardar el presupuesto:', err);
    } finally {
      setIsLoading(false);
      console.log('handleSubmit: setIsLoading(false)');
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const isReadOnly = form.estado === 'Cerrado';

  const [editRow, setEditRow] = useState({ codigo: '', cantidad: 1, costo: '', bonificacion: 0 });
  const [selectedProducto, setSelectedProducto] = useState(null);
  const codigoInputRef = useRef();

  // Función para calcular el total c/IVA en tiempo real desde la grilla
  const getTotalConIvaEnTiempoReal = () => {
    if (!itemsGridRef.current || !itemsGridRef.current.getItems) return 0;
    const items = itemsGridRef.current.getItems();
    return items.reduce((sum, item) => sum + (item.vdi_importe || 0) * (1 + (parseFloat(item.vdi_idaliiva || 0) / 100)), 0);
  };

  // Copio handleChange de VentaForm
  const handleChange = e => {
    const { name, value, type } = e.target;
    setForm(prevForm => ({
      ...prevForm,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  // Copio el diccionario de alícuotas de VentaForm
  const ALICUOTAS = {
    1: 0, // NO GRAVADO
    2: 0, // EXENTO
    3: 0, // 0%
    4: 10.5,
    5: 21,
    6: 27
  };

  // Función auxiliar para calcular subtotal de línea
  function calcularSubtotalLinea(item) {
    const cantidad = parseFloat(item.cantidad) || 0;
    const costo = parseFloat(item.costo) || 0;
    const bonif = parseFloat(item.bonificacion) || 0;
    return (costo * cantidad) * (1 - bonif / 100);
  }

  // Cálculos de totales centralizados y robustos
  function calcularTotales() {
    const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
    const desc1 = parseFloat(descu1) || 0;
    const desc2 = parseFloat(descu2) || 0;
    let subtotalSinIva = 0;
    const itemsConSubtotal = items.map(item => {
      const bonifParticular = parseFloat(item.bonificacion) || 0;
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.costo) || 0;
      let subtotal = 0;
      if (bonifParticular > 0) {
        subtotal = (precio * cantidad) * (1 - bonifParticular / 100);
      } else {
        subtotal = (precio * cantidad) * (1 - bonifGeneral / 100);
      }
      subtotalSinIva += subtotal;
      return { ...item, subtotal };
    });
    let subtotalConDescuentos = subtotalSinIva * (1 - desc1 / 100);
    subtotalConDescuentos = subtotalConDescuentos * (1 - desc2 / 100);
    let ivaTotal = 0;
    let totalConIva = 0;
    itemsConSubtotal.forEach(item => {
      const aliId = item.producto?.idaliiva || item.vdi_idaliiva;
      const aliPorc = ALICUOTAS[aliId] || 0;
      const proporcion = (item.subtotal || 0) / (subtotalSinIva || 1);
      const itemSubtotalConDescuentos = subtotalConDescuentos * proporcion;
      const iva = itemSubtotalConDescuentos * (aliPorc / 100);
      ivaTotal += iva;
      totalConIva += itemSubtotalConDescuentos + iva;
    });
    return {
      subtotalSinIva: Math.round(subtotalSinIva * 100) / 100,
      subtotalConDescuentos: Math.round(subtotalConDescuentos * 100) / 100,
      ivaTotal: Math.round(ivaTotal * 100) / 100,
      totalConIva: Math.round(totalConIva * 100) / 100,
      items: itemsConSubtotal
    };
  }

  return (
    <form className="w-full py-12 px-12 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">{initialData ? (isReadOnly ? 'Ver Presupuesto' : 'Editar Presupuesto') : 'Nuevo Presupuesto'}</h3>
      {isReadOnly && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-600 text-yellow-900 rounded">
          Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Número</label>
          <input
            name="numero"
            type="number"
            value={form.numero || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            required
            disabled={!!initialData}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-500 mb-1">Tipo de Comprobante</label>
        <ComprobanteDropdown
          opciones={[{ value: 'presupuesto', label: 'Presupuesto', icon: 'document', codigo_afip: '9997' }]}
          value={'presupuesto'}
          onChange={() => {}}
          disabled={true}
        />
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

      <div className="mb-4 flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-700">Descuento 1 (%)</label>
        <input type="number" min="0" max="100" step="0.01" value={descu1} onChange={e => setDescu1(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} className="w-20 px-2 py-1 border border-gray-300 rounded" />
        <label className="text-sm font-medium text-gray-700">Descuento 2 (%)</label>
        <input type="number" min="0" max="100" step="0.01" value={descu2} onChange={e => setDescu2(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} className="w-20 px-2 py-1 border border-gray-300 rounded" />
        <span className="text-xs text-gray-500 ml-2">Los descuentos se aplican de manera sucesiva sobre el subtotal neto.</span>
      </div>

      <div className="mb-8">
        <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems del Presupuesto</h4>
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
          <>
            <BuscadorProducto
              productos={productos}
              onSelect={handleAddItemToGrid}
            />
            <ItemsGridEdicion
              ref={itemsGridRef}
              productosDisponibles={productos}
              proveedores={proveedores}
              stockProveedores={stockProveedores}
              autoSumarDuplicados={autoSumarDuplicados}
              setAutoSumarDuplicados={setAutoSumarDuplicados}
              bonificacionGeneral={form.bonificacionGeneral}
              setBonificacionGeneral={value => setForm(f => ({ ...f, bonificacionGeneral: value }))}
              modo="edicion"
              onRowsChange={handleRowsChange}
              initialItems={items}
            />
          </>
        )}
      </div>

      <div className="mt-8 text-right font-bold text-lg">
        <div className="inline-block bg-gray-50 rounded-lg shadow px-8 py-4 text-right">
          <div className="flex flex-col gap-2 text-lg font-semibold text-gray-800">
            <div className="flex gap-6 items-center">
              <span>Subtotal s/IVA:</span>
              <span className="text-black">${(() => {
                const { subtotalSinIva } = calcularTotales();
                return Number(subtotalSinIva).toFixed(2);
              })()}</span>
              <span className="ml-8">Bonificación general:</span>
              <span className="text-black">{form.bonificacionGeneral}%</span>
              <span className="ml-8">Descuento 1:</span>
              <span className="text-black">{descu1}%</span>
              <span className="ml-8">Descuento 2:</span>
              <span className="text-black">{descu2}%</span>
            </div>
            <div className="flex gap-6 items-center">
              <span>Subtotal c/Descuentos:</span>
              <span className="text-black">{(() => {
                const { subtotalConDescuentos } = calcularTotales();
                return Number(subtotalConDescuentos).toFixed(2);
              })()}</span>
              <span className="ml-8">IVA:</span>
              <span className="text-black">{(() => {
                const { ivaTotal } = calcularTotales();
                return Number(ivaTotal).toFixed(2);
              })()}</span>
              <span className="ml-8">Total c/IVA:</span>
              <span className="text-black">{(() => {
                const { totalConIva } = calcularTotales();
                return Number(totalConIva).toFixed(2);
              })()}</span>
            </div>
          </div>
        </div>
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

export default EditarPresupuestoForm; 