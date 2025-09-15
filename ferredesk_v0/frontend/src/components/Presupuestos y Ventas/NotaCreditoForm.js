import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import useNavegacionForm from '../../hooks/useNavegacionForm';
import ItemsGrid from './ItemsGrid';
import BuscadorProducto from '../BuscadorProducto';
import { manejarCambioFormulario } from './herramientasforms/manejoFormulario';
import { mapearCamposItem, normalizarItemsStock } from './herramientasforms/mapeoItems';
// import { normalizarItems } from './herramientasforms/normalizadorItems'; // Ya no se usa
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario';
import { useAlicuotasIVAAPI } from '../../utils/useAlicuotasIVAAPI';
import SumarDuplicar from './herramientasforms/SumarDuplicar';
import { useFormularioDraft } from './herramientasforms/useFormularioDraft';
import { useComprobanteFiscal } from './herramientasforms/useComprobanteFiscal';
import { useArcaEstado } from '../../utils/useArcaEstado';
import { useArcaResultadoHandler } from '../../utils/useArcaResultadoHandler';
import ArcaEsperaOverlay from './herramientasforms/ArcaEsperaOverlay';
import useValidacionCUIT from '../../utils/useValidacionCUIT';
import CuitStatusBanner from '../Alertas/CuitStatusBanner';
import SelectorDocumento from './herramientasforms/SelectorDocumento';
import { esDocumentoEditable } from './herramientasforms/manejoFormulario';
import { useFerreDeskTheme } from '../../hooks/useFerreDeskTheme';

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
// function normalizarItemsNC(itemsSeleccionados, productosDisponibles = [], alicuotasMap = {}) {
//   return normalizarItems(itemsSeleccionados, {
//     productos: productosDisponibles,
//     modo: 'nota_credito',
//     alicuotasMap
//   });
// }

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
  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm();

  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI();
  
  // Hook para consulta de estado CUIT en ARCA
  const { 
    estadoARCAStatus,
    mensajesARCAStatus,
    isLoadingARCAStatus,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  } = useValidacionCUIT();
  
  // Hook para el tema de FerreDesk
  const theme = useFerreDeskTheme();
  
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
  
  const { 
    formulario, 
    setFormulario, 
    limpiarBorrador, 
    actualizarItems 
  } = useFormularioDraft({
    claveAlmacenamiento: `notaCreditoFormDraft_${tabKey}`,
    datosIniciales: getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos),
    combinarConValoresPorDefecto: (data) => {
      const base = getInitialFormState(clienteSeleccionado, facturasAsociadas, sucursales, puntosVenta, vendedores, plazos);
      return {
        ...base,
        ...data,
        items: Array.isArray(data?.items) ? normalizarItemsStock(data.items) : [],
      };
    },
    parametrosPorDefecto: [],
    normalizarItems: (items) => items, // ItemsGrid se encarga de la normalización
    validarBorrador: (borradorGuardado) => {
      return borradorGuardado.clienteId === clienteSeleccionado?.id;
    }
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
  // Temporizador para mostrar overlay ARCA solo si la espera es real
  const temporizadorArcaRef = useRef(null);
  
  // Estado para controlar visibilidad del banner de estado CUIT
  const [mostrarBannerCuit, setMostrarBannerCuit] = useState(false);
  
  // Documento (CUIT/DNI) con lógica fiscal para notas de crédito
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
  
  // Función para ocultar el banner de estado CUIT
  const ocultarBannerCuit = () => {
    setMostrarBannerCuit(false);
    limpiarEstadosARCAStatus();
  };
  


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

  // UseEffect para consultar estado CUIT en ARCA cuando aplique (nota de crédito A)
  useEffect(() => {
    // Solo consultar si hay datos necesarios
    if (!formulario.clienteId || !facturasAsociadas?.length) {
      setMostrarBannerCuit(false);
      limpiarEstadosARCAStatus();
      return;
    }

    // Solo consultar si la letra de la NC es A
    if (letraNC !== 'A') {
      setMostrarBannerCuit(false);
      limpiarEstadosARCAStatus();
      return;
    }

    // Validar que hay CUIT válido
    const cuitLimpio = (formulario.cuit || '').replace(/[-\s]/g, '');
    if (!cuitLimpio || cuitLimpio.length !== 11 || !/^\d{11}$/.test(cuitLimpio)) {
      setMostrarBannerCuit(true);
      // No consultar ARCA pero mostrar mensaje local de CUIT inválido
      return;
    }

    // Consultar estado en ARCA
    consultarARCAStatus(cuitLimpio);
    setMostrarBannerCuit(true);

  }, [
    letraNC,
    formulario.cuit, 
    formulario.clienteId, 
    facturasAsociadas,
    consultarARCAStatus,
    limpiarEstadosARCAStatus
  ]);

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

    // Obtener items usando la misma lógica que los otros formularios
    const itemsParaGuardar = itemsGridRef.current.getItems();

    if (itemsParaGuardar.length === 0) {
      alert("Debe agregar al menos un ítem a la nota de crédito.");
      return;
    }

    // Determinar tipo de comprobante para decidir si requiere ARCA (no iniciar overlay aquí)
    const tipoComprobanteSeleccionado = comprobanteNC?.tipo || 'nota_credito';

    const payload = {
      // Campos alineados con VentaForm.js para consistencia y robustez
      ven_estado: "CE", // Las NC se crean como 'Cerrado'
      ven_tipo: "Nota de Crédito", // Tipo de operación explícito
      // permitir_stock_negativo: se obtiene automáticamente del backend desde la configuración de la ferretería

      // NUEVO: Enviar tipo determinado automáticamente
      tipo_comprobante: tipoComprobanteSeleccionado,
      comprobante_id: comprobanteNC?.codigo_afip || '',
      comprobantes_asociados_ids: (formulario.facturasAsociadas || []).map(f => f.id || f.ven_id),
      
      ven_fecha: formulario.fecha,
      ven_idcli: formulario.clienteId,
      ven_idpla: formulario.plazoId,
      ven_idvdo: formulario.vendedorId,
      ven_sucursal: formulario.sucursalId,
      ven_copia: formulario.copia || 1,
      
      ven_descu1: formulario.descu1 || 0,
      ven_descu2: formulario.descu2 || 0,
      ven_descu3: formulario.descu3 || 0,
      bonificacionGeneral: formulario.bonificacionGeneral || 0, // Bonificación general
      ven_bonificacion_general: formulario.bonificacionGeneral || 0, // Bonificación general (duplicado por compatibilidad)

      // Campos requeridos por el modelo que no se usan en NC pero deben estar presentes
      ven_vdocomvta: 0,
      ven_vdocomcob: 0,

      // CRÍTICO: Enviar CUIT del cliente para que ARCA pueda validarlo
      ven_cuit: formulario.cuit || '',

      items: itemsParaGuardar.map((item, idx) => mapearCamposItem(item, idx))
    };
    
    try {
      // Iniciar overlay de ARCA con retardo para evitar carrera en errores rápidos
      if (requiereEmisionArca(tipoComprobanteSeleccionado) && !temporizadorArcaRef.current) {
        temporizadorArcaRef.current = setTimeout(() => {
          iniciarEsperaArca();
        }, 400);
      }

      const resultado = await onSave(payload, limpiarBorrador);
      
      // Limpiar temporizador si estaba agendado
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }

      // Procesar respuesta de ARCA usando la lógica modularizada
      procesarResultadoArca(resultado, tipoComprobanteSeleccionado)
    } catch (error) {
      // Limpiar temporizador en error
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }
      // Manejar error usando la lógica modularizada
      manejarErrorArca(error, "Error al procesar la nota de crédito")
    }
  };

  const handleCancel = () => {
    if (window.confirm('¿Está seguro de que desea cancelar? Se perderán todos los cambios no guardados.')) {
      // Limpiar temporizador si está pendiente
      if (temporizadorArcaRef.current) {
        clearTimeout(temporizadorArcaRef.current);
        temporizadorArcaRef.current = null;
      }
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

  const handleRowsChange = useCallback((rows) => {
    actualizarItems(rows);
  }, [actualizarItems]);

  // Inicializar autoSumarDuplicados si es false (igual que en VentaForm)
  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados("sumar")
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados])

  // Funciones de descuento estabilizadas con useCallback para evitar re-renders innecesarios
  const setDescu1 = useCallback((value) => {
    handleChange({ target: { name: 'descu1', value } })
  }, [handleChange])

  const setDescu2 = useCallback((value) => {
    handleChange({ target: { name: 'descu2', value } })
  }, [handleChange])

  const setDescu3 = useCallback((value) => {
    handleChange({ target: { name: 'descu3', value } })
  }, [handleChange])

  const setBonificacionGeneral = useCallback((value) => {
    setFormulario(f => ({ ...f, bonificacionGeneral: value }))
  }, [setFormulario])
  
  if (loadingAlicuotasIVA) return <p className="text-slate-600 text-center py-10">Cargando datos del formulario...</p>;
  if (errorAlicuotasIVA) return <p className="text-red-500 text-center py-10">Error al cargar datos: {errorAlicuotasIVA?.message}</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 py-6">
      <div className="px-6">
        <form className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} {...getFormProps()}>
          {/* Gradiente decorativo superior */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>
          
          <div className="px-8 pt-4 pb-6">
          {/* Banner de estado CUIT para notas de crédito A */}
          {mostrarBannerCuit && letraNC === 'A' && (
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

          <div className="absolute top-6 right-6 z-10">
            <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
              <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">{letraNC}</span>
              <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">COD {codigoAfipNC}</span>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Nueva Nota de Crédito
            </h3>
          </div>

          {/* Tarjeta de campos organizada igual a VentaForm */}
          <div className="mb-6">
            <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
              {/* Grid principal: 6 columnas (4 para campos + 2 para facturas asociadas) */}
              <div className="grid grid-cols-6 gap-4">
                {/* Columna 1-4: Campos del formulario */}
                <div className="col-span-4">
                  {/* Primera fila: 4 campos */}
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    {/* Cliente */}
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Cliente *</label>
                      <input
                        type="text"
                        value={formulario.clienteNombre || ''}
                        readOnly
                        disabled
                        className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                      />
                    </div>

                    {/* Documento */}
                    <div>
                      <SelectorDocumento
                        tipoComprobante={letraNC || 'A'}
                        esObligatorio={letraNC === 'A'}
                        valorInicial={documentoInfo.valor}
                        tipoInicial={documentoInfo.tipo}
                        onChange={handleDocumentoChange}
                        readOnly={!esDocumentoEditable(formulario.clienteId, false)}
                        className="w-full"
                      />
                    </div>

                    {/* Domicilio */}
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Domicilio</label>
                      <input
                        name="domicilio"
                        type="text"
                        value={formulario.domicilio}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        readOnly={false}
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
                      />
                    </div>
                  </div>

                  {/* Segunda fila: 3 campos */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    {/* Buscador */}
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Producto</label>
                                             <BuscadorProducto onSelect={handleAddItemToGrid} className="w-full" />
                    </div>

                    {/* Tipo de Comprobante */}
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Tipo de Comprobante *</label>
                      <select
                        value={tipoNotaCredito || ''}
                        className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                        disabled
                      >
                        <option value="">Seleccionar...</option>
                        <option value="nota_credito">Nota de Crédito</option>
                        <option value="nota_credito_interna">Nota de Crédito</option>
                      </select>
                    </div>

                    {/* Acción por defecto */}
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Acción por defecto</label>
                      <SumarDuplicar
                        autoSumarDuplicados={autoSumarDuplicados}
                        setAutoSumarDuplicados={setAutoSumarDuplicados}
                        disabled={false}
                        showLabel={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Columna 5-6: Facturas Asociadas (ocupa 2 filas) */}
                <div className="col-span-2 row-span-2">
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Facturas Asociadas</label>
                  <div className="w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-32 bg-slate-50 overflow-y-auto">
                    {(formulario.facturasAsociadas || []).map(factura => (
                      <div key={factura.id || factura.ven_id} className="text-xs font-semibold bg-slate-200 rounded px-1 py-0.5 mb-1">
                        {factura.comprobante?.letra || 'FC'} {String(factura.ven_punto || '1').padStart(4, '0')}-{String(factura.ven_numero || factura.numero || '').padStart(8, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comentado temporalmente: Facturas Asociadas */}
          {/* 
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
          */}

          <div className="mb-8">
            <ItemsGrid
              ref={itemsGridRef}
              autoSumarDuplicados={autoSumarDuplicados}
              setAutoSumarDuplicados={setAutoSumarDuplicados}
              bonificacionGeneral={formulario.bonificacionGeneral}
              setBonificacionGeneral={setBonificacionGeneral}
              modo="nota_credito"
              onRowsChange={handleRowsChange}
              initialItems={formulario.items}
              descu1={formulario.descu1}
              descu2={formulario.descu2}
              descu3={formulario.descu3}
              setDescu1={setDescu1}
              setDescu2={setDescu2}
              setDescu3={setDescu3}
              totales={totales}
              alicuotas={alicuotasMap}
            />
          </div>
          
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Crear Nota de Crédito
            </button>
          </div>
        </div>
      </form>
    </div>
      
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