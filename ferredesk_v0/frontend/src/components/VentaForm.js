import React, { useState, useEffect, useRef, useMemo } from 'react';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from './BuscadorProducto';
import ComprobanteDropdown from './ComprobanteDropdown';
import { manejarCambioFormulario, manejarCambioCliente } from './herramientasforms/manejoFormulario';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import { useClientesConDefecto } from './herramientasforms/useClientesConDefecto';
import { useCalculosFormulario, TotalesVisualizacion } from './herramientasforms/useCalculosFormulario';
import { useAlicuotasIVAAPI } from '../utils/useAlicuotasIVAAPI';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useComprobanteFiscal } from './herramientasforms/useComprobanteFiscal';

const getInitialFormState = (sucursales = [], puntosVenta = []) => ({
  numero: '',
  cliente: '',
  clienteId: '',
  cuit: '',
  domicilio: '',
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
  copia: 1
});

const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => {
  const defaults = getInitialFormState(sucursales, puntosVenta);
  return { ...defaults, ...data, items: Array.isArray(data?.items) ? data.items : [] };
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
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto();
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();

  const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false);

  // Función para normalizar items
  const normalizarItems = (items) => {
    return items.map((item, idx) => {
      // Si ya tiene producto, dejarlo
      if (item.producto) return { ...item, id: item.id || idx + 1 };
      // Buscar producto por código si es posible
      let prod = null;
      if (item.codigo || item.codvta) {
        prod = productos.find(p => (p.codvta || p.codigo)?.toString() === (item.codigo || item.codvta)?.toString());
      }
      return {
        id: item.id || idx + 1,
        producto: prod || undefined,
        codigo: item.codigo || item.codvta || (prod ? prod.codvta || prod.codigo : ''),
        denominacion: item.denominacion || item.nombre || (prod ? prod.deno || prod.nombre : ''),
        unidad: item.unidad || item.unidadmedida || (prod ? prod.unidad || prod.unidadmedida : ''),
        cantidad: item.cantidad || 1,
        costo: item.costo || item.precio || (prod ? prod.precio || prod.preciovta || prod.preciounitario : 0),
        bonificacion: item.vdi_bonifica || 0,
        subtotal: item.subtotal || 0
      };
    });
  };

  // Usar el hook useFormularioDraft
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: 'ventaFormDraft',
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems
  });

  const alicuotasMap = useMemo(() => (
    Array.isArray(alicuotasIVA)
      ? alicuotasIVA.reduce((acc, ali) => {
          acc[ali.id] = parseFloat(ali.porce) || 0;
          return acc;
        }, {})
      : {}
  ), [alicuotasIVA]);

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap
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

  // Obtener el comprobante seleccionado y su código AFIP
  const compSeleccionado = comprobantesVenta.find(c => c.id === comprobanteId);
  const comprobanteCodigoAfip = compSeleccionado ? compSeleccionado.codigo_afip : '';

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
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados('sumar');
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados]);

  const handleChange = manejarCambioFormulario(setFormulario);
  const handleClienteChange = manejarCambioCliente(setFormulario, clientes);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemsGridRef.current) return;

    try {
      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const items = itemsGridRef.current.getItems();
      limpiarBorrador();

      const payload = {
        ven_estado: 'CE',
        ven_tipo: 'Venta',
        tipo_comprobante: tipoComprobante,
        comprobante_id: comprobanteCodigoAfip,
        ven_numero: formulario.numero || numeroComprobante,
        ven_sucursal: formulario.sucursalId || 1,
        ven_fecha: formulario.fecha,
        ven_punto: formulario.puntoVentaId || 1,
        ven_impneto: formulario.ven_impneto || 0,
        ven_descu1: formulario.descu1 || 0,
        ven_descu2: formulario.descu2 || 0,
        ven_descu3: formulario.descu3 || 0,
        bonificacionGeneral: formulario.bonificacionGeneral || 0,
        ven_bonificacion_general: formulario.bonificacionGeneral || 0,
        ven_total: formulario.ven_total || 0,
        ven_vdocomvta: formulario.ven_vdocomvta || 0,
        ven_vdocomcob: formulario.ven_vdocomcob || 0,
        ven_idcli: formulario.clienteId,
        ven_idpla: formulario.plazoId,
        ven_idvdo: formulario.vendedorId,
        ven_copia: formulario.copia || 1,
        items: items.map((item, idx) => mapearCamposItem(item, idx)),
        permitir_stock_negativo: true
      };

      if (formulario.cuit) payload.ven_cuit = formulario.cuit;
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;

      await onSave(payload);
      onCancel();
    } catch (error) {
      console.error('Error al guardar venta:', error);
    }
  };

  const handleCancel = () => {
    limpiarBorrador();
    onCancel();
  };

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  // Eliminar el array tiposComprobante hardcodeado
  const [tipoComprobante, setTipoComprobante] = useState(() => {
    const comprobanteInicial = comprobantesVenta.find(c => 
      (c.tipo || '').toLowerCase() === 'venta' || 
      (c.tipo || '').toLowerCase() === 'factura'
    );
    return comprobanteInicial?.id || '';
  });

  const isReadOnly = readOnlyOverride || formulario.estado === 'Cerrado';

  // Función para actualizar los ítems en tiempo real desde ItemsGrid
  const handleRowsChange = (rows) => {
    actualizarItems(rows);
  };

  // Efecto para seleccionar automáticamente Cliente Mostrador (ID 1)
  useEffect(() => {
    if (!formulario.clienteId && clientesConDefecto.length > 0) {
      const mostrador = clientesConDefecto.find(c => String(c.id) === '1');
      if (mostrador) {
        setFormulario(prev => ({
          ...prev,
          clienteId: mostrador.id,
          cuit: mostrador.cuit || '',
          domicilio: mostrador.domicilio || '',
          plazoId: mostrador.plazoId || mostrador.plazo || ''
        }));
      }
    }
  }, [clientesConDefecto, formulario.clienteId, setFormulario]);

  // Opciones fijas para el dropdown
  const opcionesComprobante = [
    { value: 'venta', label: 'Venta', tipo: 'venta', letra: 'V' },
    { value: 'factura', label: 'Factura', tipo: 'factura' }
  ];

  // Determinar cliente seleccionado (siempre debe haber uno, por defecto el mostrador)
  const clienteSeleccionado = clientes.find(c => String(c.id) === String(formulario.clienteId))
    || clientesConDefecto.find(c => String(c.id) === String(formulario.clienteId))
    || clientesConDefecto.find(c => String(c.id) === '1'); // Mostrador por defecto

  // Construir objeto para validación fiscal con datos actuales del formulario
  const clienteParaFiscal = useMemo(() => {
    if (!clienteSeleccionado) return null;
    return {
      ...clienteSeleccionado,
      cuit: formulario.cuit,
      domicilio: formulario.domicilio,
      razon: formulario.razon || clienteSeleccionado.razon,
      nombre: formulario.nombre || clienteSeleccionado.nombre
    };
  }, [clienteSeleccionado, formulario.cuit, formulario.domicilio, formulario.razon, formulario.nombre]);

  const usarFiscal = tipoComprobante === 'factura';
  const fiscal = useComprobanteFiscal({
    tipoComprobante: usarFiscal ? 'factura' : '',
    cliente: usarFiscal ? clienteParaFiscal : null
  });
  const comprobanteLetra = usarFiscal ? fiscal.letra : 'V';
  const comprobanteRequisitos = usarFiscal ? fiscal.requisitos : null;
  const loadingComprobanteFiscal = usarFiscal ? fiscal.loading : false;
  const errorComprobanteFiscal = usarFiscal ? fiscal.error : null;

  if (loadingClientes) return <div>Cargando clientes...</div>;
  if (errorClientes) return <div>Error al cargar clientes: {errorClientes}</div>;
  if (loadingAlicuotasIVA) return <div>Cargando alícuotas de IVA...</div>;
  if (errorAlicuotasIVA) return <div>Error al cargar alícuotas de IVA: {errorAlicuotasIVA}</div>;

  return (
    <form className="w-full py-6 px-8 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      {/* Badge de letra de comprobante */}
      {comprobanteLetra && (
        <div style={{ position: 'absolute', top: 12, right: 18, zIndex: 10 }}>
          <div className="w-12 h-12 flex flex-col items-center justify-center border-2 border-gray-800 shadow-md bg-white rounded-lg">
            <span className="text-3xl font-extrabold font-mono text-gray-900 leading-none">{comprobanteLetra}</span>
            <span className="text-[10px] font-mono text-gray-700 mt-0.5">COD {comprobanteCodigoAfip || ''}</span>
          </div>
        </div>
      )}
      {/* Mensaje de requisitos solo si es factura */}
      {usarFiscal && comprobanteRequisitos && comprobanteRequisitos.mensaje && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-2 text-sm text-blue-700 bg-blue-100 px-4 py-2 rounded shadow">
          {comprobanteRequisitos.mensaje}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {initialData ? (isReadOnly ? "Ver Venta" : "Editar Venta") : "Nueva Venta"}
      </h3>
      {isReadOnly && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-600 text-yellow-900 rounded">
          Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.
        </div>
      )}
      {/* CABECERA: Grid 3 filas x 4 columnas */}
      <div className="w-full mb-4 grid grid-cols-4 grid-rows-3 gap-4">
        {/* Fila 1 */}
        <div className="col-start-1 row-start-1">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Cliente *</label>
          {loadingClientes ? (
            <div className="text-gray-500">Cargando clientes...</div>
          ) : errorClientes ? (
            <div className="text-red-600">{errorClientes}</div>
          ) : (
            <select
              name="clienteId"
              value={formulario.clienteId}
              onChange={handleClienteChange}
              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
              required
              disabled={isReadOnly}
            >
              <option value="">Seleccionar cliente...</option>
              {clientesConDefecto.map(c => (
                <option key={c.id} value={c.id}>{c.razon || c.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="col-start-2 row-start-1">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">
            CUIT {usarFiscal && fiscal.camposRequeridos.cuit && '*'}
          </label>
          <input
            name="cuit"
            type="text"
            value={formulario.cuit}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required={usarFiscal && fiscal.camposRequeridos.cuit}
            readOnly={isReadOnly}
          />
        </div>
        <div className="col-start-3 row-start-1">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Fecha</label>
          <input
            name="fecha"
            type="date"
            value={formulario.fecha}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            readOnly={isReadOnly}
          />
        </div>
        <div className="col-start-4 row-start-1">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">
            Domicilio {usarFiscal && fiscal.camposRequeridos.domicilio && '*'}
          </label>
          <input
            name="domicilio"
            type="text"
            value={formulario.domicilio}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required={usarFiscal && fiscal.camposRequeridos.domicilio}
            readOnly={isReadOnly}
          />
        </div>
        {/* Fila 2 */}
        <div className="col-start-1 row-start-2">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Sucursal *</label>
          <select
            name="sucursalId"
            value={formulario.sucursalId}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            disabled={isReadOnly}
          >
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="col-start-2 row-start-2">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Punto de Venta *</label>
          <select
            name="puntoVentaId"
            value={formulario.puntoVentaId}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            disabled={isReadOnly}
          >
            {puntosVenta.map(pv => (
              <option key={pv.id} value={pv.id}>{pv.nombre}</option>
            ))}
          </select>
        </div>
        <div className="col-start-3 row-start-2">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Plazo *</label>
          <select
            name="plazoId"
            value={formulario.plazoId}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar plazo...</option>
            {plazos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="col-start-4 row-start-2">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Vendedor *</label>
          <select
            name="vendedorId"
            value={formulario.vendedorId}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar vendedor...</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>
        {/* Fila 3 */}
        <div className="col-start-1 row-start-3 flex flex-col justify-end">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Tipo de Comprobante *</label>
          <ComprobanteDropdown
            opciones={opcionesComprobante}
            value={tipoComprobante}
            onChange={setTipoComprobante}
            disabled={isReadOnly}
            className="w-full"
          />
        </div>
        <div className="col-start-2 row-start-3 flex flex-col justify-end">
          <SumarDuplicar
            autoSumarDuplicados={autoSumarDuplicados}
            setAutoSumarDuplicados={setAutoSumarDuplicados}
          />
        </div>
        <div className="col-start-3 row-start-3"></div>
        <div className="col-start-4 row-start-3"></div>
      </div>

      {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
      <div className="mb-8">
        <h4 className="text-lg font-medium text-gray-800 mb-2">Ítems de la Venta</h4>
        <div className="flex flex-row items-center gap-2 w-full mb-2">
          <div className="min-w-[350px] w-[350px]">
            <BuscadorProducto productos={productos} onSelect={handleAddItemToGrid} />
          </div>
          <div className="flex flex-row items-center gap-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 m-0">
              Descuento 1
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formulario.descu1}
              onChange={(e) =>
                setFormulario((f) => ({ ...f, descu1: Math.max(0, Math.min(100, Number.parseFloat(e.target.value) || 0)) }))
              }
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <span className="text-sm">%</span>
            <label className="text-sm font-medium text-gray-700 ml-4 m-0">Descuento 2</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formulario.descu2}
              onChange={(e) =>
                setFormulario((f) => ({ ...f, descu2: Math.max(0, Math.min(100, Number.parseFloat(e.target.value) || 0)) }))
              }
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <span className="text-sm">%</span>
            <span
              className="relative cursor-pointer"
              onMouseEnter={() => setMostrarTooltipDescuentos(true)}
              onMouseLeave={() => setMostrarTooltipDescuentos(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-gray-400 inline-block align-middle">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              {mostrarTooltipDescuentos && (
                <span className="absolute left-6 top-1 z-20 bg-gray-800 text-white text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap">
                  Los descuentos se aplican de manera sucesiva sobre el subtotal neto.
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-8">
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
            bonificacionGeneral={formulario.bonificacionGeneral}
            setBonificacionGeneral={value => setFormulario(f => ({ ...f, bonificacionGeneral: value }))}
            modo="venta"
            onRowsChange={handleRowsChange}
          />
        )}
      </div>

      {/* Bloque de totales y descuentos centralizado */}
      <TotalesVisualizacion
        bonificacionGeneral={formulario.bonificacionGeneral}
        descu1={formulario.descu1}
        descu2={formulario.descu2}
        descu3={formulario.descu3}
        totales={totales}
      />

      <div className="mt-8 flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          {isReadOnly ? "Cerrar" : "Cancelar"}
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            {initialData ? "Guardar Cambios" : "Crear Venta"}
          </button>
        )}
      </div>
    </form>
  );
};

export default VentaForm; 