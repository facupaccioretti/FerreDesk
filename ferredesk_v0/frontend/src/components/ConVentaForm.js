import React, { useState, useEffect, useRef } from 'react';
import BuscadorProducto from './BuscadorProducto';
import ComprobanteDropdown from './ComprobanteDropdown';
import ItemsGridEdicion from './ItemsGrid';

const getInitialFormState = (presupuestoOrigen, itemsSeleccionados, sucursales = [], puntosVenta = [], productos = []) => {
  if (!presupuestoOrigen) return {
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
  };
  return {
    numero: presupuestoOrigen.numero || '',
    cliente: presupuestoOrigen.clienteId || presupuestoOrigen.ven_idcli || '',
    clienteId: presupuestoOrigen.clienteId || presupuestoOrigen.ven_idcli || '',
    plazoId: presupuestoOrigen.plazoId || presupuestoOrigen.ven_idpla || '',
    vendedorId: presupuestoOrigen.vendedorId || presupuestoOrigen.ven_idvdo || '',
    sucursalId: presupuestoOrigen.sucursalId || presupuestoOrigen.ven_sucursal || sucursales[0]?.id || '',
    puntoVentaId: presupuestoOrigen.puntoVentaId || presupuestoOrigen.ven_punto || puntosVenta[0]?.id || '',
    fecha: presupuestoOrigen.fecha || new Date().toISOString().split('T')[0],
    estado: 'Abierto',
    tipo: 'Venta',
    items: normalizarItems(itemsSeleccionados, productos),
    bonificacionGeneral: presupuestoOrigen.bonificacionGeneral || 0,
    total: presupuestoOrigen.total || 0,
    descu1: presupuestoOrigen.descu1 || 0,
    descu2: presupuestoOrigen.descu2 || 0,
    descu3: presupuestoOrigen.descu3 || 0,
    copia: presupuestoOrigen.copia || 1,
    cae: '',
  };
};

// Función para normalizar los ítems seleccionados antes de pasarlos a la grilla
function normalizarItems(itemsSeleccionados, productosDisponibles = []) {
  if (!Array.isArray(itemsSeleccionados)) return [];
  return itemsSeleccionados.map((item, idx) => {
    let prod = item.producto || productosDisponibles.find(p => p.id === (item.vdi_idsto || item.idSto || item.idsto || item.id));
    return {
      id: item.id || idx + 1,
      producto: prod,
      codigo: item.codigo || prod?.codvta || prod?.codigo || '',
      denominacion: item.denominacion || prod?.deno || prod?.nombre || '',
      unidad: item.unidad || prod?.unidad || prod?.unidadmedida || '-',
      cantidad: item.cantidad || item.vdi_cantidad || 1,
      precio: item.precio || item.costo || item.vdi_importe || 0,
      bonificacion: item.bonificacion || item.vdi_bonifica || 0,
      proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || '',
    };
  });
}

const ConVentaForm = ({
  onSave,
  onCancel,
  presupuestoOrigen,
  itemsSeleccionados,
  itemsSeleccionadosIds,
  comprobantes,
  ferreteria,
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
  tabKey
}) => {
  // console.log('itemsSeleccionados:', itemsSeleccionados);
  const [form, setForm] = useState(() => getInitialFormState(presupuestoOrigen, itemsSeleccionados, sucursales, puntosVenta, productos));
  const itemsGridRef = useRef();
  const stockProveedores = productos ? productos.reduce((map, p) => {
    if (p.stock_proveedores) map[p.id] = p.stock_proveedores;
    return map;
  }, {}) : {};

  // Comprobantes de venta
  const comprobantesVenta = comprobantes.filter(c => (c.tipo || '').toLowerCase() !== 'presupuesto');
  const [comprobanteId, setComprobanteId] = useState(() => {
    if (comprobantesVenta.length > 0) return comprobantesVenta[0].id;
    return '';
  });
  useEffect(() => {
    if (comprobantesVenta.length > 0 && !comprobanteId) {
      setComprobanteId(comprobantesVenta[0].id);
    }
  }, [comprobantesVenta, comprobanteId]);

  const numeroComprobante = (() => {
    const comp = comprobantesVenta.find(c => c.id === comprobanteId);
    if (!comp) return 1;
    return (comp.ultimo_numero || 0) + 1;
  })();

  // Estado para descuentos
  const [descu1, setDescu1] = useState(form.descu1 || 0);
  const [descu2, setDescu2] = useState(form.descu2 || 0);

  // Guardar los ids seleccionados originales del modal
  const [idsSeleccionados, setIdsSeleccionados] = useState(() => Array.isArray(itemsSeleccionadosIds)
    ? itemsSeleccionadosIds
    : (Array.isArray(itemsSeleccionados) ? itemsSeleccionados.map(i => i.id) : []));

  // Sincronizar idsSeleccionados con los props
  useEffect(() => {
    if (Array.isArray(itemsSeleccionadosIds)) {
      setIdsSeleccionados(itemsSeleccionadosIds);
    } else if (Array.isArray(itemsSeleccionados)) {
      setIdsSeleccionados(itemsSeleccionados.map(i => i.id));
    }
  }, [itemsSeleccionadosIds, itemsSeleccionados]);

  // Estado de loading para prevenir submits múltiples
  const [loading, setLoading] = useState(false);

  // Diccionario de alícuotas igual que en los otros forms
  const ALICUOTAS = {
    1: 0, 2: 0, 3: 0, 4: 10.5, 5: 21, 6: 27
  };

  // Función pura para calcular totales, igual que en EditarPresupuestoForm
  function calcularTotales(items, bonificacionGeneral, descu1, descu2) {
    const bonifGeneral = parseFloat(bonificacionGeneral) || 0;
    const desc1 = parseFloat(descu1) || 0;
    const desc2 = parseFloat(descu2) || 0;
    let subtotalSinIva = 0;
    const itemsConSubtotal = items.map(item => {
      const bonifParticular = parseFloat(item.bonificacion) || 0;
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precio) || 0;
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
      let aliId = item.producto?.idaliiva || item.vdi_idaliiva;
      if (aliId && typeof aliId === 'object') aliId = aliId.id;
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

  const [totales, setTotales] = useState(() => calcularTotales(form.items, form.bonificacionGeneral, descu1, descu2));

  useEffect(() => {
    setTotales(calcularTotales(form.items, form.bonificacionGeneral, descu1, descu2));
  }, [form.items, form.bonificacionGeneral, descu1, descu2]);

  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados('sumar');
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados]);

  const handleChange = e => {
    const { name, value, type } = e.target;
    setForm(prevForm => ({
      ...prevForm,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) {
      console.warn("[ConVentaForm] Submit ignorado: loading=true");
      return;
    }
    setLoading(true);
    try {
      // Log inicio
      console.info("[ConVentaForm] Submit iniciado");
      const items = itemsGridRef.current.getItems();
      const permitir_stock_negativo = itemsGridRef.current.getStockNegativo();
      let ven_numero = numeroComprobante;
      const itemsMapped = items.map((i, idx) => {
        let alicuotaIva = i.producto?.aliiva?.id || i.alicuotaIva || i.vdi_idaliiva;
        if (alicuotaIva && typeof alicuotaIva === 'object') {
          alicuotaIva = alicuotaIva.id;
        }
        if (!alicuotaIva) {
          throw new Error(`El producto ${i.denominacion || i.codigo || i.vdi_detalle1} no tiene alícuota de IVA asignada`);
        }
        return {
          vdi_orden: i.orden || i.index || i.vdi_orden || idx + 1,
          vdi_idsto: i.producto?.id || i.idSto || i.idsto || i.vdi_idsto || i.id,
          vdi_idpro: i.proveedorId || i.vdi_idpro || null,
          vdi_cantidad: parseFloat(i.vdi_cantidad) || 0,
          vdi_importe: parseFloat(i.precio) || 0,
          vdi_bonifica: parseFloat(i.vdi_bonifica) || 0,
          vdi_detalle1: i.vdi_detalle1 || '',
          vdi_detalle2: i.vdi_detalle2 || '',
          vdi_idaliiva: alicuotaIva,
        };
      });
      const payload = {
        ven_estado: 'CE',
        ven_tipo: 'Venta',
        tipo_comprobante: 'venta',
        comprobante: comprobanteId,
        ven_numero: ven_numero,
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
        ven_vdocomvta: form.vdocomvta || 0,
        ven_vdocomcob: form.vdocomcob || 0,
        ven_idcli: form.clienteId,
        ven_idpla: form.plazoId,
        ven_idvdo: form.vendedorId,
        ven_copia: form.copia || 1,
        items: itemsMapped,
        permitir_stock_negativo,
        presupuesto_origen: presupuestoOrigen?.ven_id || presupuestoOrigen?.id || null,
        items_seleccionados: idsSeleccionados,
      };
      console.info("[ConVentaForm] Payload enviado a onSave:", payload, "tabKey:", tabKey);
      await onSave(payload, tabKey);
    } catch (err) {
      console.error('[ConVentaForm] Error en handleSubmit:', err);
      alert('Error: ' + (err.message || 'No se pudo convertir el presupuesto a venta.'));
    } finally {
      setLoading(false);
      console.info("[ConVentaForm] Submit finalizado");
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const tiposComprobante = [
    { value: 'factura', label: 'Factura', icon: 'invoice' },
    { value: 'venta', label: 'Venta', icon: 'document', codigo_afip: '9999' },
    { value: 'nota_credito', label: 'Nota de Crédito', icon: 'credit' },
    { value: 'nota_credito_interna', label: 'Nota de Crédito Interna', icon: 'credit' },
    { value: 'nota_debito', label: 'Nota de Débito', icon: 'debit' },
    { value: 'recibo', label: 'Recibo', icon: 'receipt' },
  ];
  const [tipoComprobante, setTipoComprobante] = useState(
    tiposComprobante.find(tc => tc.value === 'venta')?.value || tiposComprobante[0].value
  );

  function calcularSubtotalLinea(item, bonifGeneral) {
    const cantidad = parseFloat(item.cantidad) || 0;
    const costo = parseFloat(item.costo) || 0;
    const bonif = item.bonificacion !== undefined ? parseFloat(item.bonificacion) || 0 : bonifGeneral;
    return (costo * cantidad) * (1 - bonif / 100);
  }

  const isReadOnly = form.estado === 'Cerrado';

  const getCurrentItems = () => {
    if (itemsGridRef.current && itemsGridRef.current.getItems) {
      return itemsGridRef.current.getItems();
    }
    return form.items;
  };

  const handleRowsChange = (rows) => {
    console.log('[ConVentaForm] handleRowsChange recibió:', rows);
    setForm(prevForm => {
      const newForm = {
        ...prevForm,
        items: rows,
      };
      console.log('[ConVentaForm] Nuevo estado del form:', newForm);
      return newForm;
    });
  };

  // Normalizar los ítems seleccionados antes de pasarlos a la grilla
  const itemsNormalizados = normalizarItems(itemsSeleccionados, productos);

  return (
    <form className="w-full py-12 px-12 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">Conversión de Presupuesto a Venta</h3>
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
      </div>

      {loadingComprobantes && <div className="mb-2 text-gray-500">Cargando tipos de comprobante...</div>}
      {errorComprobantes && <div className="mb-2 text-red-600">{errorComprobantes}</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-500 mb-1">Tipo de Comprobante *</label>
        <ComprobanteDropdown
          opciones={tiposComprobante}
          value={tipoComprobante}
          onChange={setTipoComprobante}
          disabled={isReadOnly}
        />
      </div>

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
        <h4 className="text-lg font-medium text-gray-800 mb-4">Ítems de la Venta</h4>
        <BuscadorProducto
          productos={productos}
          onSelect={producto => {
            if (itemsGridRef.current) {
              itemsGridRef.current.handleAddItem(producto);
            }
          }}
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
          <ItemsGridEdicion
            ref={itemsGridRef}
            productosDisponibles={productos}
            proveedores={proveedores}
            stockProveedores={stockProveedores}
            autoSumarDuplicados={autoSumarDuplicados}
            setAutoSumarDuplicados={setAutoSumarDuplicados}
            bonificacionGeneral={form.bonificacionGeneral}
            setBonificacionGeneral={value => setForm(f => ({ ...f, bonificacionGeneral: value }))}
            modo="venta"
            onRowsChange={handleRowsChange}
            initialItems={itemsNormalizados}
          />
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <div className="inline-block bg-gray-50 rounded-lg shadow px-8 py-4 text-right">
          <div className="flex flex-col gap-2 text-lg font-semibold text-gray-800">
            <div className="flex gap-6 items-center">
              <span>Subtotal s/IVA:</span>
              <span className="text-black">${Number(totales.subtotalSinIva || 0).toFixed(2)}</span>
              <span className="ml-8">Bonificación general:</span>
              <span className="text-black">{form.bonificacionGeneral}%</span>
              <span className="ml-8">Descuento 1:</span>
              <span className="text-black">{descu1}%</span>
              <span className="ml-8">Descuento 2:</span>
              <span className="text-black">{descu2}%</span>
            </div>
            <div className="flex gap-6 items-center">
              <span>Subtotal c/Descuentos:</span>
              <span className="text-black">{Number(totales.subtotalConDescuentos || 0).toFixed(2)}</span>
              <span className="ml-8">IVA:</span>
              <span className="text-black">{Number(totales.ivaTotal || 0).toFixed(2)}</span>
              <span className="ml-8">Total c/IVA:</span>
              <span className="text-black">{Number(totales.totalConIva || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end space-x-3">
        <button type="button" onClick={handleCancel} className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors" disabled={loading}>{loading ? 'Procesando...' : 'Crear Venta'}</button>
      </div>
    </form>
  );
};

export default ConVentaForm; 