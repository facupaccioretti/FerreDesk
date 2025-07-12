import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import BuscadorProducto from '../BuscadorProducto';
import ItemsGrid from './ItemsGrid';
import ComprobanteDropdown from '../ComprobanteDropdown';
import { useAlicuotasIVAAPI } from '../../utils/useAlicuotasIVAAPI';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { manejarCambioFormulario, manejarCambioCliente, manejarSeleccionClienteObjeto } from './herramientasforms/manejoFormulario';
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useClientesConDefecto } from './herramientasforms/useClientesConDefecto';
import ClienteSelectorModal from '../Clientes/ClienteSelectorModal';
import { normalizarItems } from './herramientasforms/normalizadorItems';

const getStockProveedoresMap = (productos) => {
  const map = {};
  productos.forEach(p => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores;
    }
  });
  return map;
};

// Función para mapear los campos del backend a los nombres del formulario
const mapearCamposPresupuesto = (data, productos, alicuotasMap) => {
  if (!data) return {};
  // LOG NUEVO: Loggear los datos crudos recibidos del backend
  console.log('[EditarPresupuestoForm] initialData recibido:', JSON.parse(JSON.stringify(data)));
  const mapeado = {
    id: data.ven_id ?? data.id ?? '',
    clienteId: data.ven_idcli ?? data.clienteId ?? '',
    cuit: data.ven_cuit ?? data.cuit ?? '',
    domicilio: data.ven_domicilio ?? data.domicilio ?? '',
    sucursalId: data.ven_sucursal ?? data.sucursalId ?? '',
    puntoVentaId: data.ven_punto ?? data.puntoVentaId ?? '',
    fecha: data.ven_fecha ?? data.fecha ?? '',
    plazoId: data.ven_idpla ?? data.plazoId ?? '',
    vendedorId: data.ven_idvdo ?? data.vendedorId ?? '',
    descu1: data.ven_descu1 ?? data.descu1 ?? 0,
    descu2: data.ven_descu2 ?? data.descu2 ?? 0,
    descu3: data.ven_descu3 ?? data.descu3 ?? 0,
    bonificacionGeneral: data.ven_bonificacion_general ?? data.bonificacionGeneral ?? 0,
    numero: data.ven_numero ?? data.numero ?? '',
    estado: data.ven_estado ?? data.estado ?? '',
    tipo: data.ven_tipo ?? data.tipo ?? '',
    comprobanteId: data.comprobante?.codigo_afip ?? data.comprobante_id ?? data.comprobanteId ?? '',
    ven_impneto: data.ven_impneto ?? 0,
    ven_total: data.ven_total ?? 0,
    ven_vdocomvta: data.ven_vdocomvta ?? 0,
    ven_vdocomcob: data.ven_vdocomcob ?? 0,
    copia: data.ven_copia ?? data.copia ?? 1,
    items: Array.isArray(data.items) ? normalizarItems(data.items, { productos, alicuotasMap }) : [],
  };
  // LOG NUEVO: Loggear los datos mapeados y normalizados
  console.log('[EditarPresupuestoForm] Datos mapeados y normalizados:', JSON.parse(JSON.stringify(mapeado)));
  return mapeado;
};

// Utilidad simple para generar un checksum estable del presupuesto original
const generarChecksum = (data) => {
  if (!data) return '';
  return JSON.stringify({
    total: data?.ven_total ?? data?.total ?? 0,
    itemsLen: Array.isArray(data?.items) ? data.items.length : 0,
    actualizado: data?.updated_at ?? null
  });
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
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  loadingProductos,
  loadingFamilias,
  loadingProveedores,
  errorProductos,
  errorFamilias,
  errorProveedores
}) => {
  console.log('[EditarPresupuestoForm] Props recibidas:', {
    initialData,
    comprobantes,
    tiposComprobante,
    tipoComprobante,
    comprobanteId: initialData?.comprobante_id
  });

  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI();
  const stockProveedores = getStockProveedoresMap(productos);

  // Calcular el mapa de alícuotas y memorizarlo para evitar re-renders innecesarios
  const alicuotasMap = useMemo(() => {
    return Array.isArray(alicuotas)
      ? alicuotas.reduce((acc, ali) => {
          acc[ali.id] = parseFloat(ali.porce) || 0;
          return acc;
        }, {})
      : {};
  }, [alicuotas]);

  // Hook unificado de estado con soporte de borrador
  const {
    formulario,
    setFormulario,
    limpiarBorrador,
    actualizarItems
  } = useFormularioDraft({
    claveAlmacenamiento: initialData && initialData.id ? `editarPresupuestoDraft_${initialData.id}` : 'editarPresupuestoDraft_nuevo',
    datosIniciales: initialData,
    combinarConValoresPorDefecto: (data) => {
      const base = mapearCamposPresupuesto(data, productos, alicuotasMap);
      return { ...base, __checksum: generarChecksum(data) };
    },
    parametrosPorDefecto: [productos, alicuotasMap],
    normalizarItems: (items) => normalizarItems(items, { productos, alicuotasMap }),
    validarBorrador: (saved, datosOriginales) => {
      // Se considera válido solo si el checksum coincide
      return saved?.__checksum === generarChecksum(datosOriginales);
    }
  });

  const itemsGridRef = useRef();
  const [gridKey, setGridKey] = useState(Date.now());

  // Handler para cambios en la grilla memorizado para evitar renders infinitos
  const handleRowsChange = useCallback((rowsActualizados) => {
    actualizarItems(rowsActualizados)
  }, [actualizarItems]);

  // Manejadores de cambios
  const handleChange = manejarCambioFormulario(setFormulario);

  const handleClienteChange = manejarCambioCliente(setFormulario, clientes);

  // Efecto: cuando llegan los productos (o cambian) volver a normalizar ítems sin producto
  useEffect(() => {
    if (!Array.isArray(productos) || productos.length === 0) return;
    if (!Array.isArray(formulario.items) || formulario.items.length === 0) return;
    const faltanProductos = formulario.items?.some(it => !it.producto);
    if (faltanProductos) {
      const itemsNormalizados = normalizarItems(formulario.items, { productos, alicuotasMap });
      actualizarItems(itemsNormalizados);
      setGridKey(Date.now()); // Forzar remount de la grilla
    }
  }, [productos, alicuotasMap]);

  // Agregar producto desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  // Calcular los totales usando el hook centralizado
  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap
  });

  // =========================
  // Selector de Clientes (Modal)
  // =========================
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto();

  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const abrirSelector = () => setSelectorAbierto(true);
  const cerrarSelector = () => setSelectorAbierto(false);

  // Callback para aplicar cliente al formulario
  const handleClienteSelect = manejarSeleccionClienteObjeto(setFormulario);

  // Previene envíos involuntarios con Enter
  const bloquearEnterSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Guardar
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("¿Está seguro de guardar los cambios?")) return;
    if (!itemsGridRef.current) return;
    try {
      const itemsToSave = itemsGridRef.current.getItems();
      console.log('[EditarPresupuestoForm/handleSubmit] Items recibidos desde la grilla:', JSON.parse(JSON.stringify(itemsToSave)));
      console.log('[EditarPresupuestoForm/handleSubmit] Formulario actual:', formulario);
      
      const comprobanteSeleccionado = comprobantes.find(c => String(c.id) === String(formulario.comprobanteId))
        || comprobantes.find(c => String(c.codigo_afip) === String(formulario.comprobanteId))
        || comprobantes.find(c => c.codigo_afip === '9997'); // Fallback Presupuesto
      const comprobanteCodigoAfip = comprobanteSeleccionado ? comprobanteSeleccionado.codigo_afip : '9997';

      console.log('[EditarPresupuestoForm/handleSubmit] ComprobanteId:', formulario.comprobanteId, '-> Código AFIP:', comprobanteCodigoAfip);
      
      let payload = {
        ven_id: parseInt(formulario.id),
        ven_estado: formulario.estado || 'AB',
        ven_tipo: formulario.tipo || 'Presupuesto',
        tipo_comprobante: 'presupuesto',
        // NO enviar comprobante_id - el backend determinará el código AFIP usando lógica fiscal
        ven_numero: Number.parseInt(formulario.numero, 10) || 1,
        ven_sucursal: Number.parseInt(formulario.sucursalId, 10) || 1,
        ven_fecha: formulario.fecha,
        ven_punto: Number.parseInt(formulario.puntoVentaId, 10) || 1,
        ven_impneto: Number.parseFloat(formulario.ven_impneto) || 0,
        ven_descu1: Number.parseFloat(formulario.descu1) || 0,
        ven_descu2: Number.parseFloat(formulario.descu2) || 0,
        ven_descu3: Number.parseFloat(formulario.descu3) || 0,
        bonificacionGeneral: Number.parseFloat(formulario.bonificacionGeneral) || 0,
        ven_bonificacion_general: Number.parseFloat(formulario.bonificacionGeneral) || 0,
        ven_total: Number.parseFloat(formulario.ven_total) || 0,
        ven_vdocomvta: Number.parseFloat(formulario.ven_vdocomvta) || 0,
        ven_vdocomcob: Number.parseFloat(formulario.ven_vdocomcob) || 0,
        ven_idcli: formulario.clienteId,
        ven_idpla: formulario.plazoId,
        ven_idvdo: formulario.vendedorId,
        ven_copia: Number.parseInt(formulario.copia, 10) || 1,
        items: itemsToSave.map((item, idx) => mapearCamposItem(item, idx)),
        permitir_stock_negativo: true,
        update_atomic: true
      };
      console.log('[EditarPresupuestoForm/handleSubmit] Payload final:', payload);
      if (formulario.cuit) payload.ven_cuit = formulario.cuit;
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;
      await onSave(payload);
      limpiarBorrador();
      onCancel();
    } catch (err) {
      console.error('Error al guardar:', err);
    }
  };

  const handleCancel = () => {
    limpiarBorrador();
    onCancel();
  };

  const isReadOnly = formulario.estado === 'Cerrado';

  // Determinar cliente actualmente seleccionado, considerando lista con cliente por defecto
  const clienteSeleccionado = clientesConDefecto.find(c => String(c.id) === String(formulario.clienteId))
    || clientes.find(c => String(c.id) === String(formulario.clienteId))
    || clientesConDefecto.find(c => String(c.id) === '1'); // Cliente mostrador si todo falla

  // LOG NUEVO: Loggear los items que se pasan al grid
  useEffect(() => {
    if (formulario && Array.isArray(formulario.items)) {
      console.log('[EditarPresupuestoForm] Items pasados al grid:', JSON.parse(JSON.stringify(formulario.items)));
    }
  }, [formulario]);

  if (loadingAlicuotas) return <div>Cargando alícuotas de IVA...</div>;
  if (errorAlicuotas) return <div>Error al cargar alícuotas de IVA: {errorAlicuotas}</div>;

  return (
    <form className="venta-form w-full py-6 px-8 bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnterSubmit}>
      {/* Gradiente decorativo superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>
      <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        {initialData ? (isReadOnly ? 'Ver Presupuesto' : 'Editar Presupuesto') : 'Nuevo Presupuesto'}
      </h3>
      {isReadOnly && (
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 border-l-4 border-amber-500 text-amber-900 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-medium">Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.</span>
          </div>
        </div>
      )}
      {/* CABECERA: 2 filas x 4 columnas (alineado con VentaForm) */}
      <div className="w-full mb-4 grid grid-cols-4 grid-rows-2 gap-4">
        {/* Fila 1 */}
        <div className="col-start-1 row-start-1">
          <label className="block text-base font-semibold text-slate-700 mb-2">Cliente *</label>
          {loadingClientes ? (
            <div className="text-gray-500">Cargando clientes...</div>
          ) : errorClientes ? (
            <div className="text-red-600">{errorClientes}</div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={clienteSeleccionado ? (clienteSeleccionado.razon || clienteSeleccionado.nombre) : ''}
                readOnly
                disabled
                className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-slate-100 text-slate-600 cursor-not-allowed"
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={abrirSelector}
                  className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors"
                  title="Buscar en lista completa"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-4 h-4 text-slate-600"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 18.75l-3.5-3.5" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="col-start-2 row-start-1">
          <label className="block text-base font-semibold text-slate-700 mb-2">CUIT</label>
          <input
            name="cuit"
            type="text"
            value={formulario.cuit}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            maxLength={11}
            readOnly={isReadOnly}
          />
        </div>
        <div className="col-start-3 row-start-1">
          <label className="block text-base font-semibold text-slate-700 mb-2">Fecha</label>
          <input
            name="fecha"
            type="date"
            value={formulario.fecha}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            required
            readOnly={isReadOnly}
          />
        </div>
        <div className="col-start-4 row-start-1">
          <label className="block text-base font-semibold text-slate-700 mb-2">Domicilio</label>
          <input
            name="domicilio"
            type="text"
            value={formulario.domicilio}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            maxLength={40}
            readOnly={isReadOnly}
          />
        </div>
        {/* Fila 2 */}
        <div className="col-start-1 row-start-2">
          <label className="block text-base font-semibold text-slate-700 mb-2">Sucursal *</label>
          <select
            name="sucursalId"
            value={formulario.sucursalId}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            required
            disabled={isReadOnly}
          >
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-2 row-start-2">
          <label className="block text-base font-semibold text-slate-700 mb-2">Punto de Venta *</label>
          <select
            name="puntoVentaId"
            value={formulario.puntoVentaId}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            required
            disabled={isReadOnly}
          >
            {puntosVenta.map((pv) => (
              <option key={pv.id} value={pv.id}>
                {pv.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-3 row-start-2">
          <label className="block text-base font-semibold text-slate-700 mb-2">Plazo *</label>
          <select
            name="plazoId"
            value={formulario.plazoId}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar plazo...</option>
            {plazos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-4 row-start-2">
          <label className="block text-base font-semibold text-slate-700 mb-2">Vendedor *</label>
          <select
            name="vendedorId"
            value={formulario.vendedorId}
            onChange={handleChange}
            className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar vendedor...</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
      <div className="mb-8">
        <div className="flex flex-row items-center gap-4 w-full mb-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 flex-wrap">
          {/* Buscador reducido */}
          <div className="min-w-[260px] w-[260px]">
            <BuscadorProducto productos={productos} onSelect={handleAddItemToGrid} />
          </div>

          {/* Tipo de comprobante (solo visual) */}
          <div className="w-40">
            <label className="block text-base font-semibold text-slate-700 mb-2">Tipo de Comprobante</label>
            <ComprobanteDropdown
              opciones={[{ value: 'presupuesto', label: 'Presupuesto', icon: 'document', codigo_afip: '9997' }]}
              value={'presupuesto'}
              onChange={() => {}}
              disabled={true}
              className="w-full max-w-[120px]"
            />
          </div>

          {/* Acción duplicar/sumar */}
          <div className="w-56">
            <SumarDuplicar
              autoSumarDuplicados={autoSumarDuplicados}
              setAutoSumarDuplicados={setAutoSumarDuplicados}
            />
          </div>
        </div>
        {loadingProductos || loadingFamilias || loadingProveedores ? (
          <div className="text-center text-gray-500 py-4">Cargando productos, familias y proveedores...</div>
        ) : errorProductos ? (
          <div className="text-center text-red-600 py-4">{errorProductos}</div>
        ) : errorFamilias ? (
          <div className="text-center text-red-600 py-4">{errorFamilias}</div>
        ) : errorProveedores ? (
          <div className="text-center text-red-600 py-4">{errorProveedores}</div>
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
            descu1={formulario.descu1}
            descu2={formulario.descu2}
            descu3={formulario.descu3}
            setDescu1={(value)=>setFormulario(f=>({...f, descu1:value}))}
            setDescu2={(value)=>setFormulario(f=>({...f, descu2:value}))}
            setDescu3={(value)=>setFormulario(f=>({...f, descu3:value}))}
            totales={totales}
            modo="presupuesto"
            alicuotas={alicuotasMap}
            onRowsChange={handleRowsChange}
            initialItems={formulario.items}
          />
        )}
      </div>

      <div className="mt-8 flex justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
        >
          {isReadOnly ? 'Cerrar' : 'Cancelar'}
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            {initialData ? 'Guardar Cambios' : 'Crear Presupuesto'}
          </button>
        )}
      </div>

      {/* Modal selector de clientes */}
      <ClienteSelectorModal
        abierto={selectorAbierto}
        onCerrar={cerrarSelector}
        clientes={clientesConDefecto}
        onSeleccionar={handleClienteSelect}
        cargando={loadingClientes}
        error={errorClientes}
      />
    </form>
  );
};

export default EditarPresupuestoForm; 