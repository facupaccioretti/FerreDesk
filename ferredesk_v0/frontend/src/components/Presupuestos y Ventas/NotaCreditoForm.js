import React, { useEffect, useRef, useMemo } from 'react';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from '../BuscadorProducto';
import { manejarCambioFormulario } from './herramientasforms/manejoFormulario';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import { normalizarItems } from './herramientasforms/normalizadorItems';
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario';
import { useAlicuotasIVAAPI } from '../../utils/useAlicuotasIVAAPI';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useComprobanteFiscal } from './herramientasforms/useComprobanteFiscal';
import { useArcaEstado } from '../../utils/useArcaEstado';
import { useArcaResultadoHandler } from '../../utils/useArcaResultadoHandler';
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay';

const getInitialFormState = (clienteSeleccionado, facturasAsociadas, sucursales = [], puntosVenta = [], vendedores = [], plazos = []) => {
  if (!clienteSeleccionado) return {}; 

  return {
    clienteId: clienteSeleccionado.id,
    clienteNombre: clienteSeleccionado.razon || clienteSeleccionado.nombre,
    cuit: clienteSeleccionado.cuit || '',
    domicilio: clienteSeleccionado.domicilio || '',
    plazoId: clienteSeleccionado.plazo_id || plazos[0]?.id || '',
    vendedorId: vendedores[0]?.id || '',
    sucursalId: sucursales[0]?.id || '',
    puntoVentaId: puntosVenta[0]?.id || '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'Abierto',
    items: [],
    bonificacionGeneral: 0,
    total: 0,
    descu1: 0,
    descu2: 0,
    descu3: 0,
    copia: 1,
    cae: '',
    facturasAsociadas: facturasAsociadas || [],
  };
};

// Función de normalización adaptada para Nota de Crédito
function normalizarItemsNC(itemsSeleccionados, productosDisponibles = [], alicuotasMap = {}) {
  return normalizarItems(itemsSeleccionados, { 
    productos: productosDisponibles, 
    modo: 'nota_credito', 
    alicuotasMap 
  });
}

// Definir constantes descriptivas para tipos y letras de comprobantes
const TIPO_NOTA_CREDITO = 'nota_credito';
const TIPO_NOTA_CREDITO_INTERNA = 'nota_credito_interna';
const LETRAS_FISCALES = ['A', 'B', 'C'];
const LETRA_INTERNA = 'I';

// Utilidad para determinar el tipo de nota de crédito y la letra según las facturas asociadas
const obtenerTipoYLetraNotaCredito = (facturasAsociadas) => {
  if (!facturasAsociadas || facturasAsociadas.length === 0) {
    return { tipo: TIPO_NOTA_CREDITO, letra: null };
  }
  const letras = [...new Set(facturasAsociadas.map(f => f.comprobante?.letra))];
  if (letras.length > 1) return { tipo: null, letra: null };
  if (letras[0] === LETRA_INTERNA) return { tipo: TIPO_NOTA_CREDITO_INTERNA, letra: LETRA_INTERNA };
  if (LETRAS_FISCALES.includes(letras[0])) return { tipo: TIPO_NOTA_CREDITO, letra: letras[0] };
  return { tipo: TIPO_NOTA_CREDITO, letra: letras[0] };
};

const NotaCreditoForm = ({
  onSave,
  onCancel,
  clienteSeleccionado,
  facturasAsociadas = [],
  comprobantes,
  plazos,
  vendedores,
  sucursales,
  puntosVenta,
  productos,
  loadingProductos,
  familias,
  loadingFamilias,
  proveedores,
  loadingProveedores,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  tabKey
}) => {
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();
  
  // Hook para manejar estado de ARCA
  const {
    esperandoArca,
    respuestaArca,
    errorArca,
    iniciarEsperaArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    limpiarEstadoArca,
    aceptarResultadoArca,
    requiereEmisionArca,
    obtenerMensajePersonalizado
  } = useArcaEstado()

  // Hook para manejar resultados de ARCA de manera modularizada
  const {
    procesarResultadoArca,
    manejarErrorArca,
    crearHandleAceptarResultadoArca
  } = useArcaResultadoHandler({
    requiereEmisionArca,
    finalizarEsperaArcaExito,
    finalizarEsperaArcaError,
    esperandoArca,
    iniciarEsperaArca
  })

  // Función personalizada para aceptar resultado de ARCA (modularizada)
  const handleAceptarResultadoArca = crearHandleAceptarResultadoArca(
    aceptarResultadoArca, 
    onCancel, 
    () => respuestaArca, 
    () => errorArca
  )
  
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: `notaCreditoFormDraft_${tabKey}`,
    datosIniciales: getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos),
    combinarConValoresPorDefecto: (data) => ({ ...getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos), ...data }),
    parametrosPorDefecto: [],
    normalizarItems: (items) => normalizarItemsNC(items, productos, alicuotasMap),
    validarBorrador: (borradorGuardado) => {
      return borradorGuardado.clienteId === clienteSeleccionado?.id;
    }
  });
  
  useEffect(() => {
    // Para asegurar que si el cliente cambia desde fuera, el form se reinicie.
    setFormulario(getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos));
  }, [clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos, setFormulario, tabKey]);

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
  
  const stockProveedores = useMemo(() => {
    const map = {};
    if (Array.isArray(productos)) {
      productos.forEach(p => {
        if (p.stock_proveedores) map[p.id] = p.stock_proveedores;
      });
    }
    return map;
  }, [productos]);

  // Lógica mejorada para determinar el tipo de NC automáticamente
  const { tipo: tipoNotaCredito, letra: letraNotaCredito } = useMemo(() => obtenerTipoYLetraNotaCredito(facturasAsociadas), [facturasAsociadas]);

  const comprobanteNC = useMemo(() => {
    if (!tipoNotaCredito) return null;
    // Buscar comprobante que coincida con tipo y letra
    return comprobantes.find(c => c.tipo === tipoNotaCredito && (letraNotaCredito ? c.letra === letraNotaCredito : true));
  }, [comprobantes, tipoNotaCredito, letraNotaCredito]);
  

  const codigoAfipNC = comprobanteNC?.codigo_afip || '';
  const letraNC = comprobanteNC?.letra || 'X';

  useComprobanteFiscal({
    puntoVenta: formulario.puntoVentaId,
    codigoAfip: codigoAfipNC,
    clienteId: formulario.clienteId,
  });

  const handleChange = manejarCambioFormulario(setFormulario);

  // Validación de consistencia de letras
  const validarConsistenciaLetras = () => {
    if (!facturasAsociadas || facturasAsociadas.length === 0) return true;
    
    const letrasFacturas = [...new Set(facturasAsociadas.map(f => f.comprobante?.letra))];
    
    if (letrasFacturas.length > 1) {
      alert(`Error: Todas las facturas asociadas deben tener la misma letra.\n` +
            `Se encontraron letras: ${letrasFacturas.join(', ')}\n\n` +
            `Según la normativa argentina, una Nota de Crédito solo puede anular ` +
            `facturas de una misma letra.`);
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar consistencia de letras antes de continuar
    if (!validarConsistenciaLetras()) {
      return;
    }
    
    if (!formulario.clienteId) {
      alert("No se ha seleccionado un cliente.");
      return;
    }

    // Filtrar la fila vacía y los ítems sin cantidad antes de enviar.
    const itemsParaGuardar = (formulario.items || []).filter(item => {
      const tieneProducto = !!item.producto;
      const tieneDenominacion = typeof item.denominacion === 'string' && item.denominacion.trim() !== '';
      const tieneCantidad = (item.cantidad ?? 0) > 0;
      
      return (tieneProducto && tieneCantidad) || (!tieneProducto && tieneDenominacion && tieneCantidad);
    });

    if (itemsParaGuardar.length === 0) {
      alert("Debe agregar al menos un ítem a la nota de crédito.");
      return;
    }

    // Verificar si requiere emisión ARCA y iniciar estado de espera
    const tipoComprobanteSeleccionado = comprobanteNC?.tipo || 'nota_credito';
    if (requiereEmisionArca(tipoComprobanteSeleccionado)) {
      iniciarEsperaArca();
    }

    const payload = {
      // Campos alineados con VentaForm.js para consistencia y robustez
      ven_estado: "CE", // Las NC se crean como 'Cerrado'
      ven_tipo: "Nota de Crédito", // Tipo de operación explícito
      permitir_stock_negativo: true, // CRÍTICO: Permite que la lógica de suma de stock no falle

      // NUEVO: Enviar tipo determinado automáticamente
      tipo_comprobante: tipoComprobanteSeleccionado,
      comprobante_id: comprobanteNC?.codigo_afip || '',
      comprobantes_asociados_ids: (formulario.facturasAsociadas || []).map(f => f.id || f.ven_id),
      
      ven_fecha: formulario.fecha,
      ven_punto: formulario.puntoVentaId,
      ven_idcli: formulario.clienteId,
      ven_idpla: formulario.plazoId,
      ven_idvdo: formulario.vendedorId,
      ven_sucursal: formulario.sucursalId,
      ven_copia: formulario.copia || 1,
      
      ven_descu1: formulario.descu1 || 0,
      ven_descu2: formulario.descu2 || 0,
      ven_descu3: formulario.descu3 || 0,
      ven_bonificacion_general: formulario.bonificacionGeneral || 0,

      // Campos requeridos por el modelo que no se usan en NC pero deben estar presentes
      ven_vdocomvta: 0,
      ven_vdocomcob: 0,

      items: itemsParaGuardar.map((item, idx) => mapearCamposItem(item, idx))
    };
    
    try {
      const resultado = await onSave(payload, limpiarBorrador);
      
      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado)
    } catch (error) {
      // Manejar error usando la lógica modularizada
      manejarErrorArca(error, "Error al procesar la nota de crédito")
    }
  };

  const handleCancel = () => {
    if (window.confirm('¿Está seguro de que desea cancelar? Se perderán todos los cambios no guardados.')) {
      limpiarEstadoArca(); // Limpiar estado de ARCA al cancelar
      limpiarBorrador();
      onCancel();
    }
  };

  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  const handleRowsChange = (rows) => {
    actualizarItems(rows);
  };
  
  const handleSumarDuplicados = () => {
    if (itemsGridRef.current) {
      itemsGridRef.current.sumarDuplicados();
    }
  };

  if (loadingAlicuotasIVA) return <p className="text-slate-600 text-center py-10">Cargando datos del formulario...</p>;
  if (errorAlicuotasIVA) return <p className="text-red-500 text-center py-10">Error al cargar datos: {errorAlicuotasIVA?.message}</p>;

  return (
    <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 -m-6 p-6">
      <form
        className="w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden"
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600"></div>

        <div className="px-8 pt-4 pb-6">
          <div className="absolute top-6 right-6 z-10">
            <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
              <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">{letraNC}</span>
              <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">COD {codigoAfipNC}</span>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Nueva Nota de Crédito
            </h3>
          </div>

          {/* Fila 1: Datos principales */}
          <div className="grid grid-cols-8 gap-x-6 gap-y-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input type="date" name="fecha" value={formulario.fecha} onChange={handleChange} className="w-full text-sm rounded-lg border-slate-300 shadow-sm" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Punto de Venta</label>
              <select name="puntoVentaId" value={formulario.puntoVentaId} onChange={handleChange} className="w-full text-sm rounded-lg border-slate-300 shadow-sm" required>
                {puntosVenta.map(pv => (<option key={pv.id} value={pv.id}>{pv.nombre}</option>))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Vendedor</label>
              <select name="vendedorId" value={formulario.vendedorId} onChange={handleChange} className="w-full text-sm rounded-lg border-slate-300 shadow-sm" required>
                {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
              </select>
            </div>
          </div>

          {/* Fila 2: Datos del cliente y facturas asociadas */}
          <div className="grid grid-cols-2 gap-x-6 mb-6">
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
              <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">Datos del Cliente</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Razón Social / Nombre</label>
                  <p className="w-full text-sm rounded-lg border-slate-300 bg-slate-200 shadow-inner px-3 py-2">{formulario.clienteNombre || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CUIT / DNI</label>
                  <p className="w-full text-sm rounded-lg border-slate-300 bg-slate-200 shadow-inner px-3 py-2">{formulario.cuit || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Domicilio</label>
                  <p className="w-full text-sm rounded-lg border-slate-300 bg-slate-200 shadow-inner px-3 py-2">{formulario.domicilio || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
              <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">Facturas Asociadas</h4>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
                {(formulario.facturasAsociadas || []).map(factura => (
                  <p key={factura.id || factura.ven_id} className="text-xs font-mono bg-slate-200 rounded-md px-2 py-1">
                    {factura.comprobante?.letra || 'FC'} {String(factura.ven_punto || '1').padStart(4, '0')}-{String(factura.ven_numero || factura.numero || '').padStart(8, '0')}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Buscador y Grilla */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex-grow">
              <BuscadorProducto onAdd={handleAddItemToGrid} {...{productos, loadingProductos, familias, loadingFamilias, proveedores, loadingProveedores}} />
            </div>
            <div className="ml-4 flex-shrink-0">
              <SumarDuplicar
                autoSumarDuplicados={autoSumarDuplicados}
                setAutoSumarDuplicados={setAutoSumarDuplicados}
                onSumarDuplicados={handleSumarDuplicados}
              />
            </div>
          </div>
          <div className="mb-4">
            <ItemsGrid
              ref={itemsGridRef}
              key={formulario.clienteId}
              initialRows={formulario.items}
              onRowsChange={handleRowsChange}
              stockProveedores={stockProveedores}
              alicuotasIVA={alicuotasIVA}
              productosDisponibles={productos}
              bonificacionGeneral={formulario.bonificacionGeneral}
              setBonificacionGeneral={(val) => handleChange({ target: { name: 'bonificacionGeneral', value: val } })}
              descu1={formulario.descu1}
              setDescu1={(val) => handleChange({ target: { name: 'descu1', value: val } })}
              descu2={formulario.descu2}
              setDescu2={(val) => handleChange({ target: { name: 'descu2', value: val } })}
              descu3={formulario.descu3}
              setDescu3={(val) => handleChange({ target: { name: 'descu3', value: val } })}
              totales={totales}
              autoSumarDuplicados={autoSumarDuplicados}
              setAutoSumarDuplicados={setAutoSumarDuplicados}
              onSumarDuplicados={handleSumarDuplicados}
            />
          </div>
          
          <hr className="my-6 border-slate-200" />
          
          {/* Botones de Acción */}
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={handleCancel} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-sm border border-slate-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-md transition-all">
              Crear Nota de Crédito
            </button>
          </div>
        </div>
      </form>
      
      {/* Overlay de espera de ARCA */}
      <ArcaEsperaOverlay 
        estaEsperando={esperandoArca}
        mensajePersonalizado={obtenerMensajePersonalizado(comprobanteNC?.tipo)}
        mostrarDetalles={true}
        respuestaArca={respuestaArca}
        errorArca={errorArca}
        onAceptar={handleAceptarResultadoArca}
      />
    </div>
  );
};

export default NotaCreditoForm; 