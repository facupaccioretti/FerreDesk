import React, { useState, useEffect, useRef } from 'react';
import BuscadorProducto from './BuscadorProducto';
import ComprobanteDropdown from './ComprobanteDropdown';
import ItemsGrid from './ItemsGrid';

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

  const itemsGridRef = useRef();

  const stockProveedores = getStockProveedoresMap(productos);

  // Nuevo: obtener comprobantes de tipo Venta (o los que no sean Presupuesto)
  const comprobantesVenta = comprobantes.filter(c => (c.tipo || '').toLowerCase() !== 'presupuesto');

  // Nuevo: id del comprobante seleccionado
  const [comprobanteId, setComprobanteId] = useState(() => {
    if (comprobantesVenta.length > 0) return comprobantesVenta[0].id;
    return '';
  });
  useEffect(() => {
    if (comprobantesVenta.length > 0 && !comprobanteId) {
      setComprobanteId(comprobantesVenta[0].id);
    }
  }, [comprobantesVenta, comprobanteId]);

  // Nuevo: calcular número de comprobante según comprobante seleccionado
  const numeroComprobante = (() => {
    const comp = comprobantesVenta.find(c => c.id === comprobanteId);
    if (!comp) return 1;
    return (comp.ultimo_numero || 0) + 1;
  })();

  useEffect(() => {
    if (!initialData) {
      localStorage.setItem('ventaFormDraft', JSON.stringify(form));
    }
  }, [form, initialData]);

  // Estado para descuentos
  const [descu1, setDescu1] = useState(form.descu1 || 0);
  const [descu2, setDescu2] = useState(form.descu2 || 0);

  useEffect(() => {
    let subtotalSinIva = 0;
    const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
    const updatedItems = form.items.map(item => {
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
    // Aplicar descuentos sucesivos al subtotal global
    let subtotalConDescuentos = subtotalSinIva * (1 - descu1 / 100);
    subtotalConDescuentos = subtotalConDescuentos * (1 - descu2 / 100);
    // Calcular IVA y total sumando ítem por ítem
    let ivaTotal = 0;
    let totalConIva = 0;
    updatedItems.forEach(item => {
      const alicuotaIva = parseFloat(item.alicuotaIva) || 0;
      // Proporción del descuento global que corresponde a este ítem
      const proporcion = (item.subtotal || 0) / (subtotalSinIva || 1);
      const itemSubtotalConDescuentos = subtotalConDescuentos * proporcion;
      const iva = itemSubtotalConDescuentos * (alicuotaIva / 100);
      ivaTotal += iva;
      totalConIva += itemSubtotalConDescuentos + iva;
    });
    setForm(prevForm => ({
      ...prevForm,
      items: updatedItems,
      ven_impneto: Math.round(subtotalConDescuentos * 100) / 100,
      ven_total: Math.round(totalConIva * 100) / 100,
      descu1,
      descu2
    }));
  }, [form.bonificacionGeneral, form.items, descu1, descu2]);

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
    localStorage.removeItem('ventaFormDraft');
    const items = itemsGridRef.current.getItems();
    const permitir_stock_negativo = itemsGridRef.current.getStockNegativo();
    const payload = {
      ven_estado: 'CE',
      ven_tipo: 'Venta',
      tipo_comprobante: tipoComprobante,
      comprobante: comprobanteId,
      ven_numero: form.numero || numeroComprobante,
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
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  // Opciones de tipo de comprobante con íconos
  const tiposComprobante = [
    { value: 'factura', label: 'Factura', icon: 'invoice' },
    { value: 'venta', label: 'Venta', icon: 'document', codigo_afip: '9999' },
    { value: 'nota_credito', label: 'Nota de Crédito', icon: 'credit' },
    { value: 'nota_credito_interna', label: 'Nota de Crédito Interna', icon: 'credit' },
    { value: 'nota_debito', label: 'Nota de Débito', icon: 'debit' },
    { value: 'recibo', label: 'Recibo', icon: 'receipt' },
  ];
  const [tipoComprobante, setTipoComprobante] = useState(
    tiposComprobante.find(tc => tc.value === 'presupuesto')?.value || tiposComprobante[0].value
  );

  // Diccionario de alícuotas
  const ALICUOTAS = {
    1: 0, // NO GRAVADO
    2: 0, // EXENTO
    3: 0, // 0%
    4: 10.5,
    5: 21,
    6: 27
  };

  // Función auxiliar para calcular el subtotal de línea
  function calcularSubtotalLinea(item, bonifGeneral) {
    const cantidad = parseFloat(item.cantidad || item.vdi_cantidad) || 0;
    const precio = parseFloat(item.precio || item.costo || item.vdi_importe) || 0;
    const bonif = item.bonificacion !== undefined ? parseFloat(item.bonificacion) || 0 : bonifGeneral;
    return (precio * cantidad) * (1 - bonif / 100);
  }

  const isReadOnly = readOnlyOverride || form.estado === 'Cerrado';

  const getCurrentItems = () => {
    if (itemsGridRef.current && itemsGridRef.current.getItems) {
      return itemsGridRef.current.getItems();
    }
    return form.items;
  };

  return (
    <form className="w-full py-12 px-12 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-xl font-semibold text-gray-800 mb-6">{initialData ? (isReadOnly ? 'Ver Venta' : 'Editar Venta') : 'Nueva Venta'}</h3>
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

      <div className="mt-8 flex justify-end">
        <div className="inline-block bg-gray-50 rounded-lg shadow px-8 py-4 text-right">
          <div className="flex flex-col gap-2 text-lg font-semibold text-gray-800">
            <div className="flex gap-6 items-center">
              <span>Subtotal s/IVA:</span>
              <span className="text-black">${(() => {
                const items = getCurrentItems();
                const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
                const subtotal = Array.isArray(items)
                  ? items.reduce((sum, i) => sum + calcularSubtotalLinea(i, bonifGeneral), 0)
                  : 0;
                return Number(subtotal).toFixed(2);
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
                const items = getCurrentItems();
                const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
                const subtotalSinIva = Array.isArray(items)
                  ? items.reduce((sum, i) => sum + calcularSubtotalLinea(i, bonifGeneral), 0)
                  : 0;
                let subtotalConDescuentos = subtotalSinIva * (1 - descu1 / 100);
                subtotalConDescuentos = subtotalConDescuentos * (1 - descu2 / 100);
                return Number(subtotalConDescuentos).toFixed(2);
              })()}</span>
              <span className="ml-8">IVA:</span>
              <span className="text-black">{(() => {
                const items = getCurrentItems();
                const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
                const subtotalSinIva = Array.isArray(items)
                  ? items.reduce((sum, i) => sum + calcularSubtotalLinea(i, bonifGeneral), 0)
                  : 0;
                let subtotalConDescuentos = subtotalSinIva * (1 - descu1 / 100);
                subtotalConDescuentos = subtotalConDescuentos * (1 - descu2 / 100);
                let ivaTotal = 0;
                items.forEach(item => {
                  const aliId = item.alicuotaIva || item.vdi_idaliiva;
                  const aliPorc = ALICUOTAS[aliId] || 0;
                  const lineaSubtotal = calcularSubtotalLinea(item, bonifGeneral);
                  const proporcion = (lineaSubtotal) / (subtotalSinIva || 1);
                  const itemSubtotalConDescuentos = subtotalConDescuentos * proporcion;
                  ivaTotal += itemSubtotalConDescuentos * (aliPorc / 100);
                });
                return Number(ivaTotal).toFixed(2);
              })()}</span>
              <span className="ml-8">Total c/IVA:</span>
              <span className="text-black">{(() => {
                const items = getCurrentItems();
                const bonifGeneral = parseFloat(form.bonificacionGeneral) || 0;
                const subtotalSinIva = Array.isArray(items)
                  ? items.reduce((sum, i) => sum + calcularSubtotalLinea(i, bonifGeneral), 0)
                  : 0;
                let subtotalConDescuentos = subtotalSinIva * (1 - descu1 / 100);
                subtotalConDescuentos = subtotalConDescuentos * (1 - descu2 / 100);
                let ivaTotal = 0;
                items.forEach(item => {
                  const aliId = item.alicuotaIva || item.vdi_idaliiva;
                  const aliPorc = ALICUOTAS[aliId] || 0;
                  const lineaSubtotal = calcularSubtotalLinea(item, bonifGeneral);
                  const proporcion = (lineaSubtotal) / (subtotalSinIva || 1);
                  const itemSubtotalConDescuentos = subtotalConDescuentos * proporcion;
                  ivaTotal += itemSubtotalConDescuentos * (aliPorc / 100);
                });
                return (subtotalConDescuentos + ivaTotal).toFixed(2);
              })()}</span>
            </div>
          </div>
        </div>
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