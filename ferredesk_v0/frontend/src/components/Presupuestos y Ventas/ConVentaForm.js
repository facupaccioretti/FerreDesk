import React, { useState, useEffect, useRef, useMemo } from 'react';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from '../BuscadorProducto';
import ComprobanteDropdown from '../ComprobanteDropdown';
import { manejarCambioFormulario, manejarCambioCliente } from './herramientasforms/manejoFormulario';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import { useClientesConDefecto } from './herramientasforms/useClientesConDefecto';
import { useCalculosFormulario, TotalesVisualizacion } from './herramientasforms/useCalculosFormulario';
import { useAlicuotasIVAAPI } from '../../utils/useAlicuotasIVAAPI';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useComprobanteFiscal } from './herramientasforms/useComprobanteFiscal';

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

    // Determinar margen priorizando el de la línea distinta de 0
    const margen = (item.vdi_margen && Number(item.vdi_margen) !== 0)
                    ? item.vdi_margen
                    : (item.margen && Number(item.margen) !== 0)
                    ? item.margen
                    : (prod?.margen ?? 0);

    let precioBase = item.precio || item.costo || item.precio_unitario_lista || item.vdi_importe || 0;
    console.debug('[ConVentaForm/normalizarItems] Márgenes/Precio preliminar', { idx, margen, precioBase });
    if (!precioBase || Number(precioBase) === 0) {
      const costo = item.vdi_costo ?? item.costo ?? prod?.costo ?? 0;
      precioBase = parseFloat(costo) * (1 + parseFloat(margen) / 100);
    }

    // Asegurar que idaliiva sea numérico
    const idaliivaRaw = prod?.idaliiva ?? item.vdi_idaliiva ?? null;
    const idaliiva = (idaliivaRaw && typeof idaliivaRaw === 'object') ? idaliivaRaw.id : idaliivaRaw;

    const obj = {
      id: item.id || idx + 1,
      producto: prod,
      codigo: item.codigo || prod?.codvta || prod?.codigo || '',
      denominacion: item.denominacion || prod?.deno || prod?.nombre || '',
      unidad: item.unidad || prod?.unidad || prod?.unidadmedida || '-',
      cantidad: item.cantidad || item.vdi_cantidad || 1,
      precio: precioBase,
      vdi_costo: item.vdi_costo ?? item.costo ?? 0,
      margen: margen,
      bonificacion: item.bonificacion || item.vdi_bonifica || 0,
      proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || '',
      idaliiva: idaliiva,
    };

    console.debug('[ConVentaForm/normalizarItems] Ítem normalizado:', { idx, obj });
    return obj;
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
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto();
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();

  // Estados de carga centralizados
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false);
  const [gridKey, setGridKey] = useState(Date.now()); // Estado para forzar remount

  // Usar el hook useFormularioDraft
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: `conVentaFormDraft_${tabKey}`,
    datosIniciales: getInitialFormState(presupuestoOrigen, itemsSeleccionados, sucursales, puntosVenta, productos),
    combinarConValoresPorDefecto: (data) => ({ ...data }),
    parametrosPorDefecto: [],
    normalizarItems: (items) => normalizarItems(items, productos),
    validarBorrador: () => false // Nunca se reutiliza borrador en Conversión
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

  // Efecto para re-normalizar items cuando los productos llegan tarde
  useEffect(() => {
    if (!Array.isArray(productos) || productos.length === 0) return;
    if (!Array.isArray(formulario.items) || formulario.items.length === 0) return;

    const faltanProductos = formulario.items.some(it => !it.producto);
    if (faltanProductos) {
      const itemsNormalizados = normalizarItems(formulario.items, productos);
      actualizarItems(itemsNormalizados);
      setGridKey(Date.now());
    }
  }, [productos]);

  const stockProveedores = useMemo(() => {
    const map = {};
    productos?.forEach(p => {
      if (p.stock_proveedores) map[p.id] = p.stock_proveedores;
    });
    return map;
  }, [productos]);

  // Comprobantes disponibles para venta (excluye presupuesto)
  const comprobantesVenta = comprobantes.filter(c => (c.tipo || '').toLowerCase() !== 'presupuesto');

  // Estado sincronizado para comprobante seleccionado
  const [comprobanteId, setComprobanteId] = useState('');

  // Estado de tipo de comprobante como string ('venta' | 'factura') y flag de inicialización
  const [tipoComprobante, setTipoComprobante] = useState('');
  const [inicializado, setInicializado] = useState(false);

  // Efecto de inicialización sincronizada (similar a VentaForm)
  useEffect(() => {
    if (!inicializado && comprobantesVenta.length > 0) {
      const compFactura = comprobantesVenta.find(c => (c.tipo || '').toLowerCase() === 'factura');
      if (compFactura) {
        setTipoComprobante('factura');
        setComprobanteId(compFactura.id);
      } else {
        setTipoComprobante('venta');
        setComprobanteId(comprobantesVenta[0].id);
      }
      setInicializado(true);
    }
  }, [inicializado, comprobantesVenta]);

  // Mantener comprobanteId sincronizado con tipoComprobante (segunda fase)
  useEffect(() => {
    const compDelTipo = comprobantesVenta.find(c => (c.tipo || '').toLowerCase() === tipoComprobante);
    if (compDelTipo && compDelTipo.id !== comprobanteId) {
      setComprobanteId(compDelTipo.id);
    }
  }, [tipoComprobante, comprobantesVenta, comprobanteId]);

  // Obtener comprobante seleccionado y su código AFIP
  const compSeleccionado = comprobantesVenta.find(c => c.id === comprobanteId);
  const comprobanteCodigoAfip = compSeleccionado?.codigo_afip || '';

  // Calcular el número de comprobante basado en el último número del comprobante seleccionado
  const numeroComprobante = useMemo(() => {
    const comp = comprobantesVenta.find(c => c.id === comprobanteId);
    if (!comp) return 1;
    return (comp.ultimo_numero || 0) + 1;
  }, [comprobantesVenta, comprobanteId]);

  // Efecto para manejar estado de carga centralizado
  useEffect(() => {
    if (!inicializado) {
      setIsLoading(true);
      return;
    }
    if (loadingClientes || loadingAlicuotasIVA) {
      setIsLoading(true);
      return;
    }
    if (errorClientes || errorAlicuotasIVA) {
      setLoadingError(errorClientes || errorAlicuotasIVA);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, [inicializado, loadingClientes, loadingAlicuotasIVA, errorClientes, errorAlicuotasIVA]);

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

  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados('sumar');
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados]);

  const handleChange = manejarCambioFormulario(setFormulario);
  const handleClienteChange = manejarCambioCliente(setFormulario, clientes);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("¿Está seguro de guardar los cambios?")) return;
    if (!itemsGridRef.current) return;

    try {
      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const items = itemsGridRef.current.getItems();
      limpiarBorrador();

      // Constantes descriptivas
      const ESTADO_VENTA_CERRADA = 'CE';
      const TIPO_VENTA = 'Venta';

      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA,
        ven_tipo: TIPO_VENTA,
        tipo_comprobante: tipoComprobante,
        comprobante_id: comprobanteCodigoAfip,
        ven_numero: Number.parseInt(formulario.numero, 10) || numeroComprobante,
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
        presupuesto_origen: presupuestoOrigen.id,
        items_seleccionados: idsSeleccionados,
        permitir_stock_negativo: false
      };

      if (formulario.cuit) payload.ven_cuit = formulario.cuit;
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;

      await onSave(payload, tabKey);
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

  // Opciones fijas para el dropdown
  const opcionesComprobante = [
    { value: 'venta', label: 'Venta', tipo: 'venta', letra: 'V' },
    { value: 'factura', label: 'Factura', tipo: 'factura' }
  ];

  const isReadOnly = formulario.estado === 'Cerrado';

  // Función para actualizar los ítems en tiempo real desde ItemsGrid
  const handleRowsChange = (rows) => {
    actualizarItems(rows);
  };

  // Determinar cliente seleccionado
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

  // Renderizado condicional centralizado
  if (isLoading) {
    return <div className="text-center py-4">Cargando...</div>;
  }

  if (loadingError) {
    return <div className="text-center text-red-600 py-4">{loadingError}</div>;
  }

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
        Conversión de Presupuesto a Venta
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
            key={gridKey}
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
            initialItems={formulario.items}
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
            Crear Venta
          </button>
        )}
      </div>
    </form>
  );
};

export default ConVentaForm; 