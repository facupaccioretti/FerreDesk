import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useNavegacionForm from '../../hooks/useNavegacionForm';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from '../BuscadorProducto';
import ComprobanteDropdown from '../ComprobanteDropdown';
import { manejarCambioFormulario, manejarSeleccionClienteObjeto, esDocumentoEditable } from './herramientasforms/manejoFormulario';
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
import { useArcaResultadoHandler } from '../../utils/useArcaResultadoHandler';
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay';
import useValidacionCUIT from '../../utils/useValidacionCUIT';
import CuitStatusBanner from '../Alertas/CuitStatusBanner';
import SelectorDocumento from './herramientasforms/SelectorDocumento';
import CampoComprobantePagado from './herramientasforms/CampoComprobantePagado';
import NuevoReciboModal from '../CuentaCorriente/NuevoReciboModal';

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
  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm();

  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto({ soloConMovimientos: false });
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();

  // Hook para consulta de estado CUIT en ARCA
  const { 
    estadoARCAStatus,
    mensajesARCAStatus,
    isLoadingARCAStatus,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  } = useValidacionCUIT();

  // Estados de carga centralizados
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [gridKey, setGridKey] = useState(Date.now()); // Estado para forzar remount
  
  // Estado para controlar visibilidad del banner de estado CUIT
  const [mostrarBannerCuit, setMostrarBannerCuit] = useState(false);

  // Estados para recibo de excedente
  const [reciboExcedente, setReciboExcedente] = useState(null);
  const [mostrarModalReciboExcedente, setMostrarModalReciboExcedente] = useState(false);


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
    () => { limpiarBorrador(); onCancel(); },
    () => respuestaArca,
    () => errorArca
  )


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
  // Estado para evitar disparos en carga inicial (similar a VentaForm)
  const [esCargaInicial, setEsCargaInicial] = useState(true);
  // Estado para evitar validación ARCA durante proceso de submit
  const [procesandoSubmit, setProcesandoSubmit] = useState(false);

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
  // Clave de borrador estable por origen (evita pérdida por cambios de tabKey)
  const claveDraft = `conVentaFormDraft_${esConversionFacturaI ? 'factura_interna' : 'presupuesto'}_${esConversionFacturaI ? (facturaInternaOrigen?.id ?? '0') : (presupuestoOrigen?.id ?? '0')}`;

  // (eliminado indicador isReady no utilizado)

  // Usar el hook useFormularioDraft
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: claveDraft,
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
        // Metadatos de origen para asociar el borrador a esta conversión
        __origenTipo: esConversionFacturaI ? 'factura_interna' : 'presupuesto',
        __origenId: esConversionFacturaI ? (facturaInternaOrigen?.id ?? null) : (presupuestoOrigen?.id ?? null),
    // Campo para "Factura Recibo"
    montoPago: 0,
      };
      // Usar items del borrador SOLO si 'data' proviene de borrador (tiene metadata propia)
      const esBorrador = data && Object.prototype.hasOwnProperty.call(data, '__origenTipo');
      const tieneItemsGuardados = esBorrador && Array.isArray(data.items) && data.items.length > 0;
      const itemsBase = tieneItemsGuardados
        ? data.items
        : (Array.isArray(itemsSeleccionados) ? itemsSeleccionados : []);

      // Normalizar items de stock para asegurar estructura consistente
      // NUEVO: Usar normalizarItems en lugar de normalizarItemsStock para preservar flags de conversión
      let itemsNormalizados = normalizarItems(itemsBase, { alicuotasMap });

      // Restaurar flags FUNDAMENTALES de ítems originales al rehidratar desde borrador
      if (esBorrador && esConversionFacturaI && Array.isArray(itemsSeleccionados) && itemsSeleccionados.length > 0) {
        const idsOriginales = new Set(itemsSeleccionados.map(it => it.id));
        itemsNormalizados = itemsNormalizados.map(it => {
          const idOri = it.idOriginal ?? null;
          if (idOri != null && idsOriginales.has(idOri)) {
            return { ...it, esBloqueado: true, noDescontarStock: true };
          }
          return it;
        });
      }

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
        items: itemsNormalizados,
        cae: '',
        total: 0,
        __origenTipo: esConversionFacturaI ? 'factura_interna' : 'presupuesto',
        __origenId: esConversionFacturaI ? (facturaInternaOrigen?.id ?? null) : (presupuestoOrigen?.id ?? null),
      };
    },
    parametrosPorDefecto: [alicuotasMap, origenDatos, itemsSeleccionados, sucursales, puntosVenta],
    validarBorrador: (saved) => {
      const origenTipoActual = esConversionFacturaI ? 'factura_interna' : 'presupuesto';
      const origenIdActual = esConversionFacturaI ? (facturaInternaOrigen?.id ?? null) : (presupuestoOrigen?.id ?? null);
      const coincideOrigen = (saved?.__origenTipo === origenTipoActual)
        && (String(saved?.__origenId ?? '') === String(origenIdActual ?? ''));
      const clienteOrigen = esConversionFacturaI
        ? (facturaInternaOrigen?.ven_idcli ?? facturaInternaOrigen?.clienteId ?? '')
        : (presupuestoOrigen?.ven_idcli ?? presupuestoOrigen?.clienteId ?? '');
      const coincideCliente = String(saved?.clienteId ?? '') === String(clienteOrigen ?? '');
      return coincideOrigen && coincideCliente;
    }
  });


  // Remontar el grid cuando el borrador haya sido rehidratado y existan items
  const remountBorradorRef = useRef(false);
  useEffect(() => {
    if (remountBorradorRef.current) return;
    if (Array.isArray(formulario.items) && formulario.items.length > 0) {
      setGridKey(Date.now());
      remountBorradorRef.current = true;
    }
  }, [formulario.items]);

  // Documento (CUIT/DNI) sin lógica fiscal (solo UI consistente con VentaForm)
  const [documentoInfo, setDocumentoInfo] = useState({
    tipo: 'cuit',
    valor: formulario.cuit || ''
  });

  const handleDocumentoChange = (nuevaInfo) => {
    setDocumentoInfo(nuevaInfo);
    setFormulario(prev => ({
      ...prev,
      cuit: nuevaInfo.valor
    }));
  };

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap
  });

  const itemsGridRef = useRef();
  // Temporizador para mostrar overlay ARCA solo si la espera es real
  const temporizadorArcaRef = useRef(null);

  // =========================
  // Selector de Clientes (Modal)
  // =========================
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const abrirSelector = () => setSelectorAbierto(true);
  const cerrarSelector = () => setSelectorAbierto(false);
  
  // Función para ocultar el banner de estado CUIT
  const ocultarBannerCuit = () => {
    setMostrarBannerCuit(false);
    limpiarEstadosARCAStatus();
  };

  // Callback base para aplicar datos del cliente al formulario
  const aplicarSeleccionCliente = manejarSeleccionClienteObjeto(setFormulario);
  // Wrapper para marcar fin de carga inicial al cambiar cliente
  const handleClienteSelect = (cliente) => {
    aplicarSeleccionCliente(cliente);
    setEsCargaInicial(false);
  };

  // Bloqueo de envío accidental con tecla Enter
  const bloquearEnterSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Efecto para re-normalizar items SOLO una vez cuando los productos llegan tarde (evita remounts durante la edición)
  const normalizacionInicialHechaRef = useRef(false);
  useEffect(() => {
    if (normalizacionInicialHechaRef.current) return;
    if (!Array.isArray(productos) || productos.length === 0) return;
    if (!Array.isArray(formulario.items) || formulario.items.length === 0) return;

    // ItemsGrid se encarga de la normalización - no hacer nada aquí
    // const faltanProductos = formulario.items.some(it => !it.producto);
    // if (faltanProductos) {
    //   const itemsNormalizados = normalizarItems(formulario.items, { alicuotasMap, modo: 'venta' });
    //   actualizarItems(itemsNormalizados);
    //   setGridKey(Date.now());
    // }
    normalizacionInicialHechaRef.current = true;
  }, [productos, alicuotasMap, actualizarItems, formulario.items]);



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

  // (El efecto que consulta ARCA se declara más abajo, luego de definir 'usarFiscal' y 'fiscal')

  // Envoltorio de handleChange para marcar fin de carga inicial en campos clave
  const handleChangeBase = manejarCambioFormulario(setFormulario);
  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Lógica específica para campo de pago
    if (name === 'montoPago') {
      const monto = parseFloat(value) || 0
      
      // Permitir escribir libremente, validar solo al enviar
      setFormulario(prev => ({
        ...prev,
        montoPago: monto
      }))
    } else {
      // Usar la función base para otros campos
      handleChangeBase(e);
    }
    
    const nombreCampo = e?.target?.name;
    if (nombreCampo === 'cuit' || nombreCampo === 'domicilio' || nombreCampo === 'clienteId') {
      setEsCargaInicial(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("¿Está seguro de guardar los cambios?")) return;
    
    // Activar flag para evitar validación ARCA durante el proceso
    setProcesandoSubmit(true);
    if (!itemsGridRef.current) return;

    try {
      // Validar campos de pago
      const montoPago = Number.parseFloat(formulario.montoPago) || 0
      const totalVenta = totales?.total || 0
      const estaPagado = montoPago > 0

      // Validación: Consumidor Final (ID=1) debe abonar exactamente el total (sin cero, sin parcial, sin excedente)
      const CLIENTE_GENERICO_ID = '1'
      if (String(formulario.clienteId) === CLIENTE_GENERICO_ID) {
        const totalEq = Number(totalVenta).toFixed(2)
        const pagoEq = Number(montoPago).toFixed(2)
        if (pagoEq !== totalEq) {
          alert(
            'El cliente "Consumidor Final" debe abonar exactamente el total de la venta.\n\n' +
            'Total requerido: $' + totalEq
          )
          setProcesandoSubmit(false)
          return
        }
      }
      
      // Tolerancia de 1 peso para evitar mensaje de excedente por diferencias mínimas
      const TOLERANCIA_MONTO = 1.00
      if (estaPagado && montoPago > totalVenta + TOLERANCIA_MONTO) {
        const excedente = montoPago - totalVenta
        
        // Preguntar si desea crear recibo de excedente
        const crearRecibo = window.confirm(
          `El monto del pago ($${montoPago.toFixed(2)}) excede el total de la venta ($${totalVenta.toFixed(2)}) por $${excedente.toFixed(2)}.\n\n` +
          `¿Desea generar un recibo por el excedente?`
        )
        
        if (!crearRecibo) {
          alert('No se puede recibir un monto mayor al total de la venta sin generar un recibo.')
          setProcesandoSubmit(false)
          return
        }
        
        // Abrir modal de recibo con datos precargados
        setMostrarModalReciboExcedente(true)
        setProcesandoSubmit(false)
        return // Detener el submit hasta que se complete el recibo
      }

      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const items = itemsGridRef.current.getItems();

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
        // Campos para "Factura Recibo"
        comprobante_pagado: estaPagado,
        monto_pago: montoPago,
        // permitir_stock_negativo: se obtiene automáticamente del backend desde la configuración de la ferretería
      };

      // Si hay recibo de excedente, agregarlo al payload
      if (reciboExcedente) {
        payload.recibo_excedente = reciboExcedente;
      }

      // NUEVO: Incluir metadata de conversión para facturas internas
      if (esConversionFacturaI) {
        payload.factura_interna_origen = facturaInternaOrigen.id;
        payload.tipo_conversion = 'factura_i_factura';
        // NO enviar items - el backend usará los existentes de la cotización
        delete payload.items;
      } else {
        payload.presupuesto_origen = presupuestoOrigen.id;
        payload.items_seleccionados = idsSeleccionados;
      }

      if (formulario.cuit) payload.ven_cuit = formulario.cuit;
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;

      // Llamar al endpoint apropiado
      const endpoint = esConversionFacturaI ? '/api/convertir-factura-interna/' : '/api/convertir-presupuesto/';
      
      // Iniciar overlay de ARCA INMEDIATAMENTE para conversiones de factura interna
      // (no usar timeout porque los errores de validación son instantáneos)
      if (requiereEmisionArca(tipoComprobante)) {
        if (esConversionFacturaI) {
          // Para conversiones, iniciar inmediatamente
          iniciarEsperaArca();
        } else if (!temporizadorArcaRef.current) {
          // Para ventas normales, usar timeout para evitar flash
          temporizadorArcaRef.current = setTimeout(() => {
            iniciarEsperaArca();
          }, 400);
        }
      }

      const resultado = await onSave(payload, tabKey, endpoint);

      // Limpiar temporizador si estaba agendado
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }
      
      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobante)
       } catch (error) {
         // Limpiar temporizador en error
         if (temporizadorArcaRef.current) {
           clearTimeout(temporizadorArcaRef.current);
           temporizadorArcaRef.current = null;
         }
         // Manejar error estándar
         manejarErrorArca(error, "Error al procesar la conversión")
       } finally {
      // Desactivar flag independientemente del resultado
      setProcesandoSubmit(false);
    }
  };

  const handleCancel = () => {
    const confirmado = window.confirm('¿Está seguro de cancelar? Se perderán todos los cambios no guardados.');
    if (!confirmado) return;
    
    // Limpiar temporizador si está pendiente
    if (temporizadorArcaRef.current) {
      clearTimeout(temporizadorArcaRef.current);
      temporizadorArcaRef.current = null;
    }
    limpiarEstadoArca(); // Limpiar estado de ARCA al cancelar
    limpiarBorrador();
    onCancel();
  };


  // Handler para cuando se guarda el recibo de excedente
  const handleReciboExcedenteGuardado = (reciboData) => {
    // Guardar recibo temporalmente
    setReciboExcedente(reciboData);
    setMostrarModalReciboExcedente(false);
    
    // Continuar con submit de venta automáticamente
    setTimeout(() => {
      realizarSubmitVenta(reciboData);
    }, 100);
  };

  // Función para realizar submit final (sin validación de excedente)
  const realizarSubmitVenta = async (reciboData = null) => {
    // Activar flag para evitar validación ARCA durante el proceso
    setProcesandoSubmit(true);
    if (!itemsGridRef.current) {
      setProcesandoSubmit(false);
      return;
    }

    try {
      // Validar campos de pago (sin validación de excedente)
      const montoPago = Number.parseFloat(formulario.montoPago) || 0;
      const estaPagado = montoPago > 0;

      const items = itemsGridRef.current.getItems();

      // Determinar el tipo de comprobante como string fijo
      const tipoComprobanteSeleccionado =
        comprobantesVenta.find((c) => c.id === comprobanteId) &&
        (comprobantesVenta.find((c) => c.id === comprobanteId).tipo || "").toLowerCase() === "factura"
          ? "factura"
          : "factura_interna";

      // Definir constantes descriptivas para valores por defecto
      const ESTADO_VENTA_CERRADA = "CE";
      const TIPO_VENTA = "Venta";

      // Construir el payload
      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA,
        ven_tipo: TIPO_VENTA,
        tipo_comprobante: tipoComprobanteSeleccionado,
        ven_numero: Number.parseInt(formulario.numero, 10) || numeroComprobante,
        ven_sucursal: Number.parseInt(formulario.sucursalId, 10) || 1,
        ven_fecha: formulario.fecha,
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
        ven_copia: formulario.copia || 1,
        comprobante_pagado: estaPagado,
        monto_pago: montoPago,
      };

      // CORREGIDO: Agregar items según el tipo de conversión
      if (esConversionFacturaI) {
        // Para facturas internas: enviar items completos (conversión total)
        payload.items = items.map((item, idx) => mapearCamposItem(item, idx));
      } else {
        // Para presupuestos: enviar items_seleccionados (conversión selectiva)
        // IMPORTANTE: Usar el estado local 'idsSeleccionados' en lugar del prop 'itemsSeleccionadosIds'
        // El estado se mantiene sincronizado y es el mismo que usa handleSubmit
        payload.items_seleccionados = idsSeleccionados;
      }

      // Si hay recibo de excedente (ya sea del estado o pasado como parámetro), agregarlo al payload
      const reciboFinal = reciboData || reciboExcedente;
      if (reciboFinal) {
        payload.recibo_excedente = reciboFinal;
      }

      // Agregar documento (CUIT/DNI) y domicilio si existen
      if (documentoInfo.tipo === 'cuit' && documentoInfo.valor) {
        payload.ven_cuit = documentoInfo.valor;
      } else if (documentoInfo.tipo === 'dni' && documentoInfo.valor) {
        payload.ven_dni = documentoInfo.valor;
      }
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;

      // NUEVO: Incluir metadata de conversión para facturas internas
      if (esConversionFacturaI) {
        payload.factura_interna_origen = facturaInternaOrigen.id;
        payload.tipo_conversion = 'factura_i_factura';
        
        // Flag para eliminación automática de auto-imputaciones (si fue confirmado por el usuario)
        if (facturaInternaOrigen.eliminarAutoImputaciones) {
          payload.eliminar_auto_imputaciones = true;
        }
      } else {
        payload.presupuesto_origen = presupuestoOrigen.id;
        payload.tipo_conversion = 'presupuesto_factura';
      }

      // Determinar el endpoint correcto según el tipo de conversión
      const endpoint = esConversionFacturaI ? '/api/convertir-factura-interna/' : '/api/convertir-presupuesto/';

      // Iniciar overlay de ARCA con retardo para evitar carrera en errores rápidos
      if (requiereEmisionArca(tipoComprobanteSeleccionado) && !temporizadorArcaRef.current) {
        temporizadorArcaRef.current = setTimeout(() => {
          iniciarEsperaArca();
        }, 400);
      }

      const resultado = await onSave(payload, tabKey, endpoint);

      // Limpiar temporizador si había sido agendado
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }
      
      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado);
    } catch (error) {
      // Asegurar limpieza del temporizador si hubo error
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }
      // Manejar error usando la lógica modularizada
      manejarErrorArca(error, "Error al procesar la venta");
    } finally {
      // Desactivar flag independientemente del resultado
      setProcesandoSubmit(false);
    }
  };

  // Handler para cerrar modal de recibo de excedente
  const handleCerrarModalRecibo = () => {
    setMostrarModalReciboExcedente(false);
    setReciboExcedente(null);
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
    
    // Si es conversión de presupuesto, permitir cotización (factura interna) y factura (igual que VentaForm)
    return [
      { value: 'factura_interna', label: 'Cotización', tipo: 'factura_interna', letra: 'I' },
      { value: 'factura', label: 'Factura', tipo: 'factura' }
    ];
  }, [esConversionFacturaI]);

  const isReadOnly = formulario.estado === 'Cerrado';

  // Función para actualizar los ítems en tiempo real desde ItemsGrid (memoizada)
  const handleRowsChange = useCallback((rows) => {
    actualizarItems(rows);
  }, [actualizarItems]);

  // Funciones de descuento estabilizadas con useCallback para evitar re-renders innecesarios
  const setDescu1 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu1: value }))
  }, [setFormulario])

  const setDescu2 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu2: value }))
  }, [setFormulario])

  const setDescu3 = useCallback((value) => {
    setFormulario(f => ({ ...f, descu3: value }))
  }, [setFormulario])

  const setBonificacionGeneral = useCallback((value) => {
    setFormulario(f => ({ ...f, bonificacionGeneral: value }))
  }, [setFormulario])

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
    letraComprobanteMostrar = fiscal.letra || "";
    codigoAfipMostrar = fiscal.comprobanteFiscal.codigo_afip;
  } else if (comprobantes.length > 0 && comprobanteId) {
    const compSeleccionado = comprobantes.find((c) => c.id === comprobanteId);
    if (compSeleccionado) {
      letraComprobanteMostrar = compSeleccionado.letra || "V";
      codigoAfipMostrar = compSeleccionado.codigo_afip || "";
    }
  }

  // UseEffect para consultar estado CUIT en ARCA cuando aplique (solo letra fiscal A real)
  const debounceRef = useRef(null);
  useEffect(() => {
    // Evitar en carga inicial, si aún no se inicializó el formulario, o durante submit
    if (!inicializado || esCargaInicial || procesandoSubmit) return;

    // Solo consultar si es comprobante de tipo factura (fiscal)
    if (tipoComprobante !== 'factura') {
      setMostrarBannerCuit(false);
      limpiarEstadosARCAStatus();
      return;
    }

    // Esperar a que la lógica fiscal resuelva el comprobante (como en VentaForm)
    const letraFiscal = usarFiscal && fiscal.comprobanteFiscal ? fiscal.letra : null;
    if (letraFiscal !== 'A') {
      setMostrarBannerCuit(false);
      limpiarEstadosARCAStatus();
      return;
    }

    // Validar que hay CUIT con formato válido
    const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '');
    if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
      setMostrarBannerCuit(true);
      return;
    }

    // Debounce de la consulta a ARCA para evitar llamadas al tipear
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      consultarARCAStatus(cuitLimpio);
      setMostrarBannerCuit(true);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };

  }, [
    tipoComprobante,
    usarFiscal,
    fiscal?.letra,
    fiscal?.comprobanteFiscal,
    formulario.cuit,
    formulario.clienteId,
    inicializado,
    esCargaInicial,
    procesandoSubmit,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  ]);

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

  // (bloque movido arriba para respetar reglas de hooks)

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
        <form className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnterSubmit} {...getFormProps()}>
          {/* Gradiente decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>

          <div className="px-8 pt-4 pb-6">

            {/* Banner de estado CUIT para conversiones a factura fiscal A */}
            {mostrarBannerCuit && !procesandoSubmit && tipoComprobante === 'factura' && (() => {
              const comprobanteSeleccionado = comprobantesVenta.find(c => c.id === comprobanteId);
              return comprobanteSeleccionado?.letra === 'A';
            })() && (
              <CuitStatusBanner
                cuit={formulario.cuit}
                estado={(() => {
                  const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '');
                  if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
                    return 'error';
                  }
                  return estadoARCAStatus || 'ok';
                })()}
                mensajes={(() => {
                  const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '');
                  if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
                    return ['CUIT faltante o inválido. Verificar datos del cliente.'];
                  }
                  return mensajesARCAStatus || [];
                })()}
                onDismiss={ocultarBannerCuit}
                isLoading={isLoadingARCAStatus}
              />
            )}

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
{esConversionFacturaI ? 'Conversión de Cotización a Factura Fiscal' : 'Conversión de Presupuesto a Venta'}
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

            {/* Tarjeta de campos organizada igual a VentaForm */}
            <div className="mb-6">
              <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                {/* Primera fila: 6 campos */}
                <div className="grid grid-cols-6 gap-4 mb-3">
                  {/* Cliente */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Cliente *</label>
                    {loadingClientes ? (
                      <div className="flex items-center gap-2 text-slate-500 bg-slate-100 rounded-none px-2 py-1 text-xs h-8">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                        Cargando...
                      </div>
                    ) : errorClientes ? (
                      <div className="text-red-600 bg-red-50 rounded-none px-2 py-1 text-xs border border-red-200 h-8">{errorClientes}</div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={clienteSeleccionado ? (clienteSeleccionado.razon || clienteSeleccionado.nombre) : ''}
                          readOnly
                          disabled
                          className="flex-1 border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                        />
                        {!isReadOnly && (
                          <button type="button" onClick={abrirSelector} className="p-1 rounded-none border border-slate-300 bg-white hover:bg-slate-100 transition-colors h-8 w-8 flex items-center justify-center" title="Buscar en lista completa">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Documento */}
                  <div>
                    <SelectorDocumento
                      tipoComprobante={fiscal.letra}
                      esObligatorio={usarFiscal && fiscal.camposRequeridos.cuit}
                      valorInicial={documentoInfo.valor}
                      tipoInicial={documentoInfo.tipo}
                      onChange={handleDocumentoChange}
                      readOnly={!esDocumentoEditable(formulario.clienteId, isReadOnly)}
                      className="w-full"
                    />
                  </div>

                  {/* Domicilio */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Domicilio {usarFiscal && fiscal.camposRequeridos.domicilio && fiscal.letra !== 'B' && <span className="text-orange-600">*</span>}</label>
                    <input
                      name="domicilio"
                      type="text"
                      value={formulario.domicilio}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required={usarFiscal && fiscal.camposRequeridos.domicilio && fiscal.letra !== 'B'}
                      readOnly={isReadOnly}
                    />
                  </div>

                  {/* Fecha */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Fecha</label>
                    <input
                      name="fecha"
                      type="date"
                      value={formulario.fecha}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                      readOnly={isReadOnly}
                    />
                  </div>

                  {/* Plazo */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Plazo *</label>
                    <select
                      name="plazoId"
                      value={formulario.plazoId}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                      disabled={isReadOnly}
                    >
                      <option value="">Seleccionar...</option>
                      {(() => {
                        const activos = Array.isArray(plazos) ? plazos.filter(p => p && p.activo === 'S') : []
                        const seleccionado = Array.isArray(plazos) ? plazos.find(p => String(p.id) === String(formulario.plazoId)) : null
                        const visibles = seleccionado && seleccionado.activo !== 'S' ? [...activos, seleccionado] : activos
                        return visibles.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))
                      })()}
                    </select>
                  </div>

                  {/* Vendedor */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Vendedor *</label>
                    <select
                      name="vendedorId"
                      value={formulario.vendedorId}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      required
                      disabled={isReadOnly}
                    >
                      <option value="">Seleccionar...</option>
                      {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
                    </select>
                  </div>
                </div>

                {/* Segunda fila: 4 campos */}
                <div className="grid grid-cols-4 gap-4 mb-3">
                  {/* Buscador */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Producto</label>
                    <BuscadorProducto onSelect={handleAddItemToGrid} disabled={isReadOnly} readOnly={isReadOnly} className="w-full" />
                  </div>

                  {/* Tipo de Comprobante */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Tipo de Comprobante *</label>
                    <ComprobanteDropdown
                      opciones={opcionesComprobante}
                      value={tipoComprobante}
                      onChange={setTipoComprobante}
                      disabled={isReadOnly || esConversionFacturaI}
                      className="w-full"
                    />
                  </div>

                  {/* Acción por defecto */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">Acción por defecto</label>
                    <SumarDuplicar
                      autoSumarDuplicados={autoSumarDuplicados}
                      setAutoSumarDuplicados={setAutoSumarDuplicados}
                      disabled={isReadOnly || esConversionFacturaI}
                      showLabel={false}
                    />
                  </div>

                  {/* Campo Comprobante Pagado */}
                  <CampoComprobantePagado 
                    formulario={formulario}
                    handleChange={handleChange}
                    totales={totales}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <ItemsGrid
                key={gridKey}
                ref={itemsGridRef}
                autoSumarDuplicados={autoSumarDuplicados}
                setAutoSumarDuplicados={setAutoSumarDuplicados}
                bonificacionGeneral={formulario.bonificacionGeneral}
                setBonificacionGeneral={setBonificacionGeneral}
                descu1={formulario.descu1}
                descu2={formulario.descu2}
                descu3={formulario.descu3}
                setDescu1={setDescu1}
                setDescu2={setDescu2}
                setDescu3={setDescu3}
                totales={totales}
                modo="venta"
                alicuotas={alicuotasMap}
                onRowsChange={handleRowsChange}
                initialItems={normalizarItems(formulario.items || [], { 
                  modo: 'venta', 
                  alicuotasMap,
                  esConversionFacturaI: esConversionFacturaI
                })}
                readOnly={esConversionFacturaI || isReadOnly}
              />
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                {isReadOnly ? "Cerrar" : "Cancelar"}
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Crear Venta
                </button>
              )}
            </div>
          </div>
        </form>
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

      {/* Modal de recibo de excedente */}
      <NuevoReciboModal
        modal={{
          abierto: mostrarModalReciboExcedente,
          clienteId: formulario.clienteId,
        }}
        onClose={handleCerrarModalRecibo}
        onGuardar={handleReciboExcedenteGuardado}
        esReciboExcedente={true}
        montoFijo={Math.round((Number(formulario.montoPago || 0) - Number(totales?.total || 0)) * 100) / 100}
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
    </div>
  );
};

export default ConVentaForm; 