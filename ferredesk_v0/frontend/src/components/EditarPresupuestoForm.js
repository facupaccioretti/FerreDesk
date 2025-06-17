import React, { useRef, useEffect, useState } from 'react';
import BuscadorProducto from './BuscadorProducto';
import ItemsGrid from './ItemsGrid';
import ComprobanteDropdown from './ComprobanteDropdown';
import { useAlicuotasIVAAPI } from '../utils/useAlicuotasIVAAPI';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { manejarCambioFormulario, manejarCambioCliente } from './herramientasforms/manejoFormulario';
import { useCalculosFormulario, TotalesVisualizacion } from './herramientasforms/useCalculosFormulario';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';

const getStockProveedoresMap = (productos) => {
  const map = {};
  productos.forEach(p => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores;
    }
  });
  return map;
};

const normalizarItems = (items, productosDisponibles = []) => {
  // Alineado con la lógica de ConVentaForm para garantizar coherencia de datos
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => {
    const prod = item.producto || productosDisponibles.find(p => String(p.id) === String(item.vdi_idsto || item.idSto || item.idsto || item.id));

    // DEBUG LOG: estado crudo del ítem
    console.debug('[EditarPresupuestoForm/normalizarItems] Ítem crudo:', { idx, item });

    const margen = (item.vdi_margen && Number(item.vdi_margen) !== 0)
                  ? item.vdi_margen
                  : (item.margen && Number(item.margen) !== 0)
                  ? item.margen
                  : (prod?.margen ?? 0);

    let precioBase =
      item.precio ??
      item.costo ??
      item.precio_unitario_lista ??
      item.vdi_importe ??
      prod?.precio ??
      prod?.preciovta ??
      prod?.preciounitario ??
      0;

    console.debug('[EditarPresupuestoForm/normalizarItems] Márgenes/Precio preliminar', { idx, margen, precioBase });

    // Si sigue sin valor, calcular basado en costo + margen
    if (!precioBase || Number(precioBase) === 0) {
      const costo = item.vdi_costo ?? item.costo ?? prod?.costo ?? 0;
      precioBase = parseFloat(costo) * (1 + parseFloat(margen) / 100);
    }

    const obj = {
      id: item.id || idx + 1,
      producto: prod,
      codigo: item.codigo || item.codvta || prod?.codvta || prod?.codigo || '',
      denominacion: item.denominacion || item.vdi_detalle1 || prod?.deno || prod?.nombre || '',
      unidad: item.unidad || item.vdi_detalle2 || prod?.unidad || prod?.unidadmedida || '-',
      cantidad: item.cantidad || item.vdi_cantidad || 1,
      precio: precioBase,
      vdi_costo: item.vdi_costo ?? item.costo ?? 0,
      margen: margen,
      bonificacion: item.bonificacion || item.vdi_bonifica || 0,
      proveedorId: item.proveedorId || item.vdi_idpro || item.idPro || '',
      idaliiva: (prod?.idaliiva && typeof prod.idaliiva === 'object') ? prod.idaliiva.id : (prod?.idaliiva ?? item.vdi_idaliiva ?? null),
      subtotal: item.subtotal || 0,
    };

    // El log final debe ser después de crear el objeto pero antes de devolverlo
    console.debug('[EditarPresupuestoForm/normalizarItems] Ítem normalizado:', { idx, obj });

    return obj;
  });
};

// Función para mapear los campos del backend a los nombres del formulario
const mapearCamposPresupuesto = (data, productos) => {
  if (!data) return {};
  return {
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
    comprobanteId: data.comprobante_id ?? data.comprobanteId ?? '',
    ven_impneto: data.ven_impneto ?? 0,
    ven_total: data.ven_total ?? 0,
    ven_vdocomvta: data.ven_vdocomvta ?? 0,
    ven_vdocomcob: data.ven_vdocomcob ?? 0,
    copia: data.ven_copia ?? data.copia ?? 1,
    items: Array.isArray(data.items) ? normalizarItems(data.items, productos) : [],
  };
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
      const base = mapearCamposPresupuesto(data, productos);
      return { ...base, __checksum: generarChecksum(data) };
    },
    parametrosPorDefecto: [productos],
    normalizarItems: (items) => normalizarItems(items, productos),
    validarBorrador: (saved, datosOriginales) => {
      // Se considera válido solo si el checksum coincide
      return saved?.__checksum === generarChecksum(datosOriginales);
    }
  });

  const itemsGridRef = useRef();
  const [gridKey, setGridKey] = useState(Date.now());

  // Handler para cambios en la grilla
  const handleRowsChange = (rows) => {
    actualizarItems(rows);
  };

  // Manejadores de cambios
  const handleChange = manejarCambioFormulario(setFormulario);

  const handleClienteChange = manejarCambioCliente(setFormulario, clientes);

  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI();
  const stockProveedores = getStockProveedoresMap(productos);

  // Efecto: cuando llegan los productos (o cambian) volver a normalizar ítems sin producto
  useEffect(() => {
    if (!Array.isArray(productos) || productos.length === 0) return;
    if (!Array.isArray(formulario.items) || formulario.items.length === 0) return;
    const faltanProductos = formulario.items?.some(it => !it.producto);
    if (faltanProductos) {
      const itemsNormalizados = normalizarItems(formulario.items, productos);
      actualizarItems(itemsNormalizados);
      setGridKey(Date.now()); // Forzar remount de la grilla
    }
  }, [productos]);

  // Agregar producto desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  // Calcular el mapa de alícuotas
  const alicuotasMap = (Array.isArray(alicuotas)
    ? alicuotas.reduce((acc, ali) => {
        acc[ali.id] = parseFloat(ali.porce) || 0;
        return acc;
      }, {})
    : {});

  // Calcular los totales usando el hook centralizado
  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap
  });

  // Guardar
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemsGridRef.current) return;
    try {
      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const itemsToSave = itemsGridRef.current.getItems();
      let payload = {
        ven_id: parseInt(formulario.id),
        ven_estado: formulario.estado || 'AB',
        ven_tipo: formulario.tipo || 'Presupuesto',
        tipo_comprobante: 'presupuesto',
        comprobante_id: formulario.comprobanteId || '',
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

  if (loadingAlicuotas) return <div>Cargando alícuotas de IVA...</div>;
  if (errorAlicuotas) return <div>Error al cargar alícuotas de IVA: {errorAlicuotas}</div>;

  return (
    <form className="w-full py-6 px-8 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {initialData ? (isReadOnly ? 'Ver Presupuesto' : 'Editar Presupuesto') : 'Nuevo Presupuesto'}
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
          <select
            name="clienteId"
            value={formulario.clienteId}
            onChange={handleClienteChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            required
            disabled={isReadOnly}
          >
            <option value="">Seleccionar cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon || c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-start-2 row-start-1">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">CUIT</label>
          <input
            name="cuit"
            type="text"
            value={formulario.cuit}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            maxLength={11}
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
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Domicilio</label>
          <input
            name="domicilio"
            type="text"
            value={formulario.domicilio}
            onChange={handleChange}
            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
            maxLength={40}
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
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
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
            {puntosVenta.map((pv) => (
              <option key={pv.id} value={pv.id}>
                {pv.nombre}
              </option>
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
            {plazos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
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
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
        {/* Fila 3 */}
        <div className="col-start-1 row-start-3 flex flex-col justify-end">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Tipo de Comprobante</label>
          <ComprobanteDropdown
            opciones={[{ value: 'presupuesto', label: 'Presupuesto', icon: 'document', codigo_afip: '9997' }]}
            value={'presupuesto'}
            onChange={() => {}}
            disabled={true}
            className="w-full"
          />
        </div>
        <div className="col-start-2 row-start-3 flex flex-col justify-end">
          <SumarDuplicar autoSumarDuplicados={autoSumarDuplicados} setAutoSumarDuplicados={setAutoSumarDuplicados} />
        </div>
        <div className="col-start-3 row-start-3"></div>
        <div className="col-start-4 row-start-3"></div>
      </div>

      {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
      <div className="mb-8">
        <h4 className="text-lg font-medium text-gray-800 mb-2">Ítems del Presupuesto</h4>
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
              onChange={handleChange}
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
              onChange={handleChange}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <span className="text-sm">%</span>
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
            modo="presupuesto"
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
    </form>
  );
};

export default EditarPresupuestoForm; 