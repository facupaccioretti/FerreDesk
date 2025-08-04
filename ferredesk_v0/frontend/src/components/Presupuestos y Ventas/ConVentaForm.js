import React, { useState, useEffect, useRef, useMemo } from 'react';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from '../BuscadorProducto';
import ComprobanteDropdown from '../ComprobanteDropdown';
import { manejarCambioFormulario, manejarSeleccionClienteObjeto } from './herramientasforms/manejoFormulario';
import { mapearCamposItem } from './herramientasforms/mapeoItems';
import { useClientesConDefecto } from './herramientasforms/useClientesConDefecto';
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario';
import { useAlicuotasIVAAPI } from '../../utils/useAlicuotasIVAAPI';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useComprobanteFiscal } from './herramientasforms/useComprobanteFiscal';
import ClienteSelectorModal from '../Clientes/ClienteSelectorModal';
import { normalizarItems } from './herramientasforms/normalizadorItems';
import { useArcaEstado } from '../../utils/useArcaEstado';
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay';

const ConVentaForm = ({
  onSave,
  onCancel,
  presupuestoOrigen,
  facturaInternaOrigen,  // NUEVO: para conversiones de facturas internas
  tipoConversion,        // NUEVO: 'presupuesto_venta' | 'factura_i_factura'
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
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto({ soloConMovimientos: false });
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();

  // Función personalizada para aceptar resultado de ARCA y cerrar pestaña
  const handleAceptarResultadoArca = () => {
    aceptarResultadoArca()
    onCancel()
  }

  // Estados de carga centralizados
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [gridKey, setGridKey] = useState(Date.now()); // Estado para forzar remount

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

  const alicuotasMap = useMemo(() => (
    Array.isArray(alicuotasIVA)
      ? alicuotasIVA.reduce((acc, ali) => {
          acc[ali.id] = parseFloat(ali.porce) || 0;
          return acc;
        }, {})
      : {}
  ), [alicuotasIVA]);

  // Estados sincronizados para comprobante y tipo (igual que VentaForm)
  const [inicializado, setInicializado] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [comprobanteId, setComprobanteId] = useState("");

  // Efecto de inicialización sincronizada (igual que VentaForm)
  useEffect(() => {
    if (!inicializado && comprobantes.length > 0) {
      const comprobanteFacturaInterna = comprobantes.find((c) => (c.tipo || "").toLowerCase() === "factura_interna");
      if (comprobanteFacturaInterna) {
        setTipoComprobante("factura_interna");
        setComprobanteId(comprobanteFacturaInterna.id);
      } else {
        setTipoComprobante(comprobantes[0].tipo?.toLowerCase() || "factura_interna");
        setComprobanteId(comprobantes[0].id);
      }
      setInicializado(true);
    }
  }, [inicializado, comprobantes]);

  useEffect(() => {
    if (comprobantes.length > 0 && !comprobanteId) {
      setComprobanteId(comprobantes[0].id);
    }
  }, [comprobantes, comprobanteId]);

  // Determinar origen de datos
  const origenDatos = facturaInternaOrigen || presupuestoOrigen;
  const esConversionFacturaI = tipoConversion === 'factura_i_factura';

  // Usar el hook useFormularioDraft
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: `conVentaFormDraft_${tabKey}`,
    datosIniciales: origenDatos,
    combinarConValoresPorDefecto: (data) => {
      if (!data) return {
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
        clienteId: data.ven_idcli ?? data.clienteId ?? '',
        cuit: data.ven_cuit ?? data.cuit ?? '',
        domicilio: data.ven_domicilio ?? data.domicilio ?? '',
        plazoId: data.ven_idpla ?? data.plazoId ?? '',
        vendedorId: data.ven_idvdo ?? data.vendedorId ?? '',
        sucursalId: data.ven_sucursal ?? data.sucursalId ?? sucursales?.[0]?.id ?? '',
        puntoVentaId: data.ven_punto ?? data.puntoVentaId ?? puntosVenta?.[0]?.id ?? '',
        bonificacionGeneral: data.ven_bonificacion_general ?? data.bonificacionGeneral ?? 0,
        descu1: data.ven_descu1 ?? data.descu1 ?? 0,
        descu2: data.ven_descu2 ?? data.descu2 ?? 0,
        descu3: data.ven_descu3 ?? data.descu3 ?? 0,
        copia: data.ven_copia ?? data.copia ?? 1,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'Abierto',
        tipo: 'Venta',
        items: normalizarItems(itemsSeleccionados, { 
          productos, 
          alicuotasMap, 
          modo: 'venta',
          // NUEVO: metadata para conversión de facturas internas
          metadataConversion: esConversionFacturaI ? {
            tipoConversion: 'factura_i_factura',
            facturaInternaOrigenId: facturaInternaOrigen?.id
          } : null
        }),
        cae: '',
        total: 0,
      };
    },
    parametrosPorDefecto: [productos, alicuotasMap, origenDatos, itemsSeleccionados, sucursales, puntosVenta],
    normalizarItems: (items) => normalizarItems(items, { productos, alicuotasMap, modo: 'venta' }),
    validarBorrador: () => false // Nunca se reutiliza borrador en Conversión
  });

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap
  });

  const itemsGridRef = useRef();

  // =========================
  // Selector de Clientes (Modal)
  // =========================
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const abrirSelector = () => setSelectorAbierto(true);
  const cerrarSelector = () => setSelectorAbierto(false);

  // Callback reutilizable para aplicar datos del cliente al formulario
  const handleClienteSelect = manejarSeleccionClienteObjeto(setFormulario);

  // Bloqueo de envío accidental con tecla Enter
  const bloquearEnterSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Efecto para re-normalizar items cuando los productos llegan tarde
  useEffect(() => {
    if (!Array.isArray(productos) || productos.length === 0) return;
    if (!Array.isArray(formulario.items) || formulario.items.length === 0) return;

    const faltanProductos = formulario.items.some(it => !it.producto);
    if (faltanProductos) {
      const itemsNormalizados = normalizarItems(formulario.items, { productos, alicuotasMap, modo: 'venta' });
      actualizarItems(itemsNormalizados);
      setGridKey(Date.now());
    }
  }, [productos, alicuotasMap, actualizarItems, formulario.items]);

  const stockProveedores = useMemo(() => {
    const map = {};
    productos?.forEach(p => {
      if (p.stock_proveedores) map[p.id] = p.stock_proveedores;
    });
    return map;
  }, [productos]);

  // Comprobantes disponibles para venta (excluye presupuesto)
  const comprobantesVenta = comprobantes.filter(c => (c.tipo || '').toLowerCase() !== 'presupuesto');

  // Efecto de inicialización sincronizada (similar a VentaForm)
  useEffect(() => {
    if (!inicializado && comprobantesVenta.length > 0) {
      // Si es conversión de factura interna, forzar tipo 'factura'
      if (esConversionFacturaI) {
        const compFactura = comprobantesVenta.find(c => (c.tipo || '').toLowerCase() === 'factura');
        if (compFactura) {
          setTipoComprobante('factura');
          setComprobanteId(compFactura.id);
        }
      } else {
        // Para presupuestos, lógica normal
        const compFactura = comprobantesVenta.find(c => (c.tipo || '').toLowerCase() === 'factura');
        if (compFactura) {
          setTipoComprobante('factura');
          setComprobanteId(compFactura.id);
        } else {
          setTipoComprobante('venta');
          setComprobanteId(comprobantesVenta[0].id);
        }
      }
      setInicializado(true);
    }
  }, [inicializado, comprobantesVenta, esConversionFacturaI]);

  // Mantener comprobanteId sincronizado con tipoComprobante (segunda fase)
  useEffect(() => {
    const compDelTipo = comprobantesVenta.find(c => (c.tipo || '').toLowerCase() === tipoComprobante);
    if (compDelTipo && compDelTipo.id !== comprobanteId) {
      setComprobanteId(compDelTipo.id);
    }
  }, [tipoComprobante, comprobantesVenta, comprobanteId]);

  // HÍBRIDO: useComprobanteFiscal solo para preview visual
  // El backend ejecutará su propia lógica fiscal autoritaria

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

      // Verificar si requiere emisión ARCA y iniciar estado de espera
      if (requiereEmisionArca(tipoComprobante)) {
        iniciarEsperaArca();
      }

      // Constantes descriptivas
      const ESTADO_VENTA_CERRADA = 'CE';
      const TIPO_VENTA = 'Venta';

      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA,
        ven_tipo: TIPO_VENTA,
        tipo_comprobante: tipoComprobante,
        // NO enviar comprobante_id - el backend determinará el código AFIP usando lógica fiscal
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
        permitir_stock_negativo: false
      };

      // NUEVO: Incluir metadata de conversión para facturas internas
      if (esConversionFacturaI) {
        payload.factura_interna_origen = facturaInternaOrigen.id;
        payload.tipo_conversion = 'factura_i_factura';
        payload.items_seleccionados = idsSeleccionados;
        payload.conversion_metadata = {
          items_originales: items.filter(item => item.idOriginal).map(item => ({
            id_original: item.idOriginal,
            no_descontar_stock: item.noDescontarStock
          }))
        };
      } else {
        payload.presupuesto_origen = presupuestoOrigen.id;
        payload.items_seleccionados = idsSeleccionados;
      }

      if (formulario.cuit) payload.ven_cuit = formulario.cuit;
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;

      // Llamar al endpoint apropiado
      const endpoint = esConversionFacturaI ? '/api/convertir-factura-interna/' : '/api/convertir-presupuesto/';
      
      const resultado = await onSave(payload, tabKey, endpoint);
      
      // Procesar respuesta de ARCA si corresponde
      if (requiereEmisionArca(tipoComprobante)) {
        if (resultado?.arca_emitido && resultado?.cae) {
          finalizarEsperaArcaExito({
            cae: resultado.cae,
            cae_vencimiento: resultado.cae_vencimiento,
            qr_generado: resultado.qr_generado,
            observaciones: resultado.observaciones || []
          })
          // NO llamar onCancel() aquí - se llamará desde handleAceptarResultadoArca
        } else if (resultado?.error) {
          finalizarEsperaArcaError(resultado.error)
          // NO llamar onCancel() aquí - se llamará desde handleAceptarResultadoArca
        } else {
          finalizarEsperaArcaError("Error desconocido en la emisión ARCA")
          // NO llamar onCancel() aquí - se llamará desde handleAceptarResultadoArca
        }
      } else {
        // Solo cerrar la pestaña si NO requiere emisión ARCA
        onCancel();
      }
    } catch (error) {
      console.error('Error al guardar venta:', error);
      // Si hay error y estaba esperando ARCA, finalizar con error
      if (esperandoArca) {
        finalizarEsperaArcaError(error.message || "Error al procesar la conversión")
      }
    }
  };

  const handleCancel = () => {
    limpiarEstadoArca(); // Limpiar estado de ARCA al cancelar
    limpiarBorrador();
    onCancel();
  };

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto);
    }
  };

  // Opciones dinámicas para el dropdown según tipo de conversión
  const opcionesComprobante = useMemo(() => {
    // Si es conversión de factura interna, solo permitir factura
    if (esConversionFacturaI) {
      return [
        { value: 'factura', label: 'Factura', tipo: 'factura' }
      ];
    }
    
    // Si es conversión de presupuesto, permitir factura interna y factura (igual que VentaForm)
    return [
      { value: 'factura_interna', label: 'Factura Interna', tipo: 'factura_interna', letra: 'I' },
      { value: 'factura', label: 'Factura', tipo: 'factura' }
    ];
  }, [esConversionFacturaI]);

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
  const comprobanteRequisitos = usarFiscal ? fiscal.requisitos : null;

  // Determinar el código AFIP y la letra a mostrar en el badge (igual que VentaForm)
  let letraComprobanteMostrar = "V";
  let codigoAfipMostrar = "";
  if (usarFiscal && fiscal.comprobanteFiscal && fiscal.comprobanteFiscal.codigo_afip) {
    letraComprobanteMostrar = fiscal.letra || "A";
    codigoAfipMostrar = fiscal.comprobanteFiscal.codigo_afip;
  } else if (comprobantes.length > 0 && comprobanteId) {
    const compSeleccionado = comprobantes.find((c) => c.id === comprobanteId);
    if (compSeleccionado) {
      letraComprobanteMostrar = compSeleccionado.letra || "V";
      codigoAfipMostrar = compSeleccionado.codigo_afip || "";
    }
  }

  // Renderizado condicional centralizado
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
          <div className="text-red-600 font-medium mb-2">Error al cargar</div>
          <p className="text-red-700 text-sm">{loadingError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 py-6">
      <div className="px-6">
        <form className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnterSubmit}>
          {/* Gradiente decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>

          {/* Contenedor interior con padding igual a VentaForm */}
          <div className="px-8 pt-4 pb-6">

            {/* Badge de letra del comprobante */}
            {letraComprobanteMostrar && (
              <div className="absolute top-6 right-6 z-10">
                <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
                  <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">{letraComprobanteMostrar}</span>
                  <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">COD {codigoAfipMostrar}</span>
                </div>
              </div>
            )}

            {/* Mensaje requisitos (solo factura) */}
            {usarFiscal && comprobanteRequisitos && comprobanteRequisitos.mensaje && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-4 text-sm text-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 rounded-xl shadow-lg border border-blue-200/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {comprobanteRequisitos.mensaje}
                </div>
              </div>
            )}

            {/* Título y estado */}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0118 0Z" />
                  </svg>
                </div>
{esConversionFacturaI ? 'Conversión de Factura Interna a Factura Fiscal' : 'Conversión de Presupuesto a Venta'}
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
            </div>

            {/* CABECERA organizada en dos filas de 4 columnas */}
            <div className="w-full mb-4">
              {/* Fila 1: Cliente | CUIT | Domicilio | Fecha */}
              <div className="grid grid-cols-4 gap-4 mb-3 items-end">
                {/* Cliente */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Cliente *</label>
                  {loadingClientes ? (
                    <div className="flex items-center gap-2 text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                      Cargando clientes...
                    </div>
                  ) : errorClientes ? (
                    <div className="text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
                      {errorClientes}
                    </div>
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
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 18.75l-3.5-3.5" /></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* CUIT */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">CUIT {usarFiscal && fiscal.camposRequeridos.cuit && <span className="text-orange-600">*</span>}</label>
                  <input
                    name="cuit"
                    type="text"
                    value={formulario.cuit}
                    onChange={handleChange}
                    className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                    required={usarFiscal && fiscal.camposRequeridos.cuit}
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Domicilio */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Domicilio {usarFiscal && fiscal.camposRequeridos.domicilio && <span className="text-orange-600">*</span>}</label>
                  <input
                    name="domicilio"
                    type="text"
                    value={formulario.domicilio}
                    onChange={handleChange}
                    className="compacto max-w-sm w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                    required={usarFiscal && fiscal.camposRequeridos.domicilio}
                    readOnly={isReadOnly}
                  />
                </div>

                {/* Fecha */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Fecha</label>
                  <input
                    name="fecha"
                    type="date"
                    value={formulario.fecha}
                    onChange={handleChange}
                    className="compacto max-w-[9rem] w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                    required
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Fila 2: Sucursal | Punto de Venta | Plazo | Vendedor */}
              <div className="grid grid-cols-4 gap-4 items-end">
                {/* Sucursal */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Sucursal *</label>
                  <select
                    name="sucursalId"
                    value={formulario.sucursalId}
                    onChange={handleChange}
                    className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                    required
                    disabled={isReadOnly}
                  >
                    {sucursales.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                  </select>
                </div>

                {/* Punto de Venta */}
                <div className="w-full">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Punto de Venta *</label>
                  <select
                    name="puntoVentaId"
                    value={formulario.puntoVentaId}
                    onChange={handleChange}
                    className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 shadow-sm hover:border-slate-400"
                    required
                    disabled={isReadOnly}
                  >
                    {puntosVenta.map(pv => (<option key={pv.id} value={pv.id}>{pv.nombre}</option>))}
                  </select>
                </div>

                {/* Plazo */}
                <div className="w-full">
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
                    {plazos.map(p => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                  </select>
                </div>

                {/* Vendedor */}
                <div className="w-full">
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
                    {vendedores.map(v => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
                  </select>
                </div>
              </div>
            </div>

            {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
            <div className="mb-8">
              {/* Encabezado eliminado para alinear con VentaForm */}
              <div className="flex flex-row items-center gap-4 w-full mb-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 flex-wrap">
                {/* Buscador reducido */}
                <div className="min-w-[260px] w-[260px]">
                  <BuscadorProducto productos={productos} onSelect={handleAddItemToGrid} />
                </div>

                {/* Tipo de comprobante */}
                <div className="w-40">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Tipo de Comprobante *</label>
                  <ComprobanteDropdown
                    opciones={opcionesComprobante}
                    value={tipoComprobante}
                    onChange={setTipoComprobante}
                    disabled={isReadOnly || esConversionFacturaI}
                    className="w-full max-w-[120px]"
                  />
                </div>

                {/* Acción duplicar / sumar */}
                <div className="w-56">
                  <SumarDuplicar
                    autoSumarDuplicados={autoSumarDuplicados}
                    setAutoSumarDuplicados={setAutoSumarDuplicados}
                  />
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
                  descu1={formulario.descu1}
                  descu2={formulario.descu2}
                  descu3={formulario.descu3}
                  setDescu1={(value)=>setFormulario(f=>({...f, descu1:value}))}
                  setDescu2={(value)=>setFormulario(f=>({...f, descu2:value}))}
                  setDescu3={(value)=>setFormulario(f=>({...f, descu3:value}))}
                  totales={totales}
                  modo="venta"
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
          
          {/* Overlay de espera de ARCA */}
          <ArcaEsperaOverlay 
            estaEsperando={esperandoArca}
            mensajePersonalizado={obtenerMensajePersonalizado(tipoComprobante)}
            mostrarDetalles={true}
            respuestaArca={respuestaArca}
            errorArca={errorArca}
            onAceptar={handleAceptarResultadoArca}
          />
        </form>
      </div>
    </div>
  );
};

export default ConVentaForm; 