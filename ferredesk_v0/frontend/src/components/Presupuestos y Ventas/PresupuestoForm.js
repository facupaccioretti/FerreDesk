"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import ComprobanteDropdown from "../ComprobanteDropdown"
import { manejarCambioFormulario, manejarSeleccionClienteObjeto, validarDocumentoCliente } from "./herramientasforms/manejoFormulario"
import { mapearCamposItem, normalizarItemsStock } from "./herramientasforms/mapeoItems"
import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario'
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { useFormularioDraft } from "./herramientasforms/useFormularioDraft"
import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"
// import { normalizarItems } from './herramientasforms/normalizadorItems' // Ya no se usa
import SelectorDocumento from "./herramientasforms/SelectorDocumento"

// (eliminado helper de stock_proveedores no utilizado en Presupuesto)

//  getInitialFormState arriba para que esté definida antes de mergeWithDefaults
const getInitialFormState = (sucursales = [], puntosVenta = []) => ({
  numero: "",
  cliente: "",
  clienteId: "",
  plazoId: "",
  vendedorId: "",
  sucursalId: sucursales[0]?.id || "",
  puntoVentaId: puntosVenta[0]?.id || "",
  fecha: new Date().toISOString().split("T")[0],
  estado: "Abierto",
  tipo: "Presupuesto",
  items: [],
  bonificacionGeneral: 0,
  total: 0,
  descu1: 0,
  descu2: 0,
  descu3: 0,
  copia: 1,
  ven_impneto: 0,
  ven_total: 0,
  ven_vdocomvta: 0,
  ven_vdocomcob: 0,
  ven_idcli: "",
  ven_idpla: "",
  ven_idvdo: "",
  ven_copia: 1,
  cuit: "",
  domicilio: "",
})

// Agrego la función mergeWithDefaults
const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => {
  const defaults = getInitialFormState(sucursales, puntosVenta)
  return { ...defaults, ...data, items: Array.isArray(data?.items) ? normalizarItemsStock(data.items) : [] }
}

const PresupuestoForm = ({
  onSave,
  onCancel,
  initialData,
  readOnlyOverride,
  comprobantes,
  tiposComprobante,
  tipoComprobante,
  setTipoComprobante,
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
  errorProductos,
  errorFamilias,
  errorProveedores,
  loadingAlicuotas,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
  tabKey = `presupuesto-${Date.now()}` // Valor por defecto en caso de que no se pase
}) => {
  const theme = useFerreDeskTheme()
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto({ soloConMovimientos: false })
  const { alicuotas, loading: loadingAlicuotasHook, error: errorAlicuotas } = useAlicuotasIVAAPI()

  const alicuotasMap = useMemo(
    () =>
      Array.isArray(alicuotas)
        ? alicuotas.reduce((acc, ali) => {
            acc[ali.id] = Number.parseFloat(ali.porce) || 0
            return acc
          }, {})
        : {},
    [alicuotas],
  )

  // Función wrapper para normalizar items usando el normalizador unificado
  // const normalizarItemsPresupuesto = (items) => {
  //   return normalizarItems(items, { 
  //     productos, 
  //     modo: 'presupuesto', 
  //     alicuotasMap 
  //   })
  // }

  // Usar el hook useFormularioDraft
  const { formulario, setFormulario, limpiarBorrador, actualizarItems } = useFormularioDraft({
    claveAlmacenamiento: `presupuestoFormDraft_${tabKey}`,
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems: (items) => items, // ItemsGrid se encarga de la normalización
  })

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap,
  })

  // handleRowsChange ahora usa actualizarItems
  const handleRowsChange = useCallback((rows) => {
    actualizarItems(rows)
  }, [actualizarItems])

  // (eliminada memoización de stock_proveedores no utilizada)

  const itemsGridRef = useRef()

  // Estado local para documento (CUIT/DNI) sin lógica fiscal
  const [documentoInfo, setDocumentoInfo] = useState({
    tipo: 'cuit',
    valor: formulario.cuit || ''
  })

  const handleDocumentoChange = (nuevaInfo) => {
    setDocumentoInfo(nuevaInfo)
    setFormulario(prev => ({
      ...prev,
      cuit: nuevaInfo.valor
    }))
  }

  // Sincronizar documentoInfo cuando cambie formulario.cuit
  useEffect(() => {
    if (formulario.cuit) {
      const cuitLimpio = formulario.cuit.replace(/[-\s]/g, '')
      
      if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
        setDocumentoInfo({
          tipo: 'cuit',
          valor: formulario.cuit,
          esValido: true
        })
      } else {
        setDocumentoInfo({
          tipo: 'dni',
          valor: formulario.cuit,
          esValido: true
        })
      }
    } else {
      setDocumentoInfo({
        tipo: 'cuit',
        valor: '',
        esValido: false
      })
    }
  }, [formulario.cuit])

  // Inicializar documentoInfo cuando se cargue el formulario
  useEffect(() => {
    if (formulario.cuit) {
      const cuitLimpio = formulario.cuit.replace(/[-\s]/g, '')
      
      if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
        setDocumentoInfo({
          tipo: 'cuit',
          valor: formulario.cuit,
          esValido: true
        })
      } else {
        setDocumentoInfo({
          tipo: 'dni',
          valor: formulario.cuit,
          esValido: true
        })
      }
    }
  }, [formulario.cuit]) // Agregar formulario.cuit como dependencia

  // ----------------- Estado de carga General ------------------
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)

  // ------------------ Lógica de carga -------------------------
  useEffect(() => {
    // Si cualquiera de los recursos clave sigue cargando, mantener spinner
    if (loadingClientes || loadingAlicuotasHook || loadingProductos || loadingProveedores) {
      setIsLoading(true)
      return
    }

    // Si hay errores en alguno, mostrar mensaje
    if (errorClientes || errorAlicuotas || errorProductos || errorProveedores) {
      setLoadingError(errorClientes || errorAlicuotas || errorProductos || errorProveedores)
      setIsLoading(false)
      return
    }

    setLoadingError(null)
    setIsLoading(false)
  }, [loadingClientes, loadingAlicuotasHook, loadingProductos, loadingProveedores, errorClientes, errorAlicuotas, errorProductos, errorProveedores])

  // Manejo simple de errores (sin ARCA)
  const mostrarError = useCallback((error, mensajePorDefecto = "Error al procesar el presupuesto") => {
    const mensaje = (error && error.message) ? error.message : mensajePorDefecto
    try { window.alert(mensaje) } catch (_) {}
  }, [])

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!window.confirm("¿Está seguro de guardar los cambios?")) return
    if (!itemsGridRef.current) {
      return
    }

    try {
      // ATENCIÓN: El payload que se envía al backend DEBE contener SOLO los campos base requeridos por el modelo físico.
      // NUNCA incluir campos calculados como vdi_importe, vdi_importe_total, vdi_ivaitem, ven_total, iva_global, etc.
      // La función mapearCamposItem ya filtra y elimina estos campos, pero si modificas este código, revisa DOCUMENTACION_VISTAS_VENTAS.md y Roadmap.txt.
      // Si tienes dudas, consulta con el equipo antes de modificar la estructura del payload.
      // El backend rechazará cualquier campo calculado y solo aceptará los campos base.

      const items = itemsGridRef.current.getItems()

      // Si es edición, asegurar tipos y mapeo correcto
      let payload
      if (initialData && initialData.id) {
        // Edición
        payload = {
          ven_estado: formulario.estado || "AB",
          ven_tipo: formulario.tipo || "Presupuesto",
          tipo_comprobante: "presupuesto",
          comprobante_id: formulario.comprobanteId || "",
          ven_numero: Number.parseInt(formulario.numero, 10) || 1,
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
          ven_copia: Number.parseInt(formulario.copia, 10) || 1,
          items: items.map((item, idx) => mapearCamposItem(item, idx)),
          // permitir_stock_negativo: se obtiene automáticamente del backend desde la configuración de la ferretería
        }
        if (formulario.cuit) payload.ven_cuit = formulario.cuit;
        if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;
      } else {
        // Nuevo presupuesto
        const compPresupuesto = comprobantes.find((c) => c.codigo_afip === "9997")
        const comprobanteCodigoAfip = compPresupuesto ? compPresupuesto.codigo_afip : "9997"
        payload = {
          ven_estado: "AB",
          ven_tipo: "Presupuesto",
          tipo_comprobante: "presupuesto",
          comprobante_id: comprobanteCodigoAfip,
          ven_numero: formulario.numero || 1,
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
          // permitir_stock_negativo: se obtiene automáticamente del backend desde la configuración de la ferretería
        }
        if (formulario.cuit) payload.ven_cuit = formulario.cuit;
        if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;
      }

      await onSave(payload)
      limpiarBorrador()
      onCancel()
    } catch (error) {
      mostrarError(error, "Error al procesar el presupuesto")
    }
  }

  const handleCancel = () => {
    const confirmado = window.confirm('¿Está seguro de cancelar? Se perderán todos los cambios no guardados.');
    if (!confirmado) return;
    
    limpiarBorrador() // Usar limpiarBorrador en lugar de localStorage.removeItem
    onCancel()
  }

  const isReadOnly = readOnlyOverride || formulario.estado === "Cerrado"

  // Reemplazar handleChange por manejarCambioFormulario
  const handleChange = manejarCambioFormulario(setFormulario)

  const handleClienteSelect = (clienteSeleccionado) => {
    // Usar la función estándar para autocompletar todos los campos del cliente
    manejarSeleccionClienteObjeto(setFormulario)(clienteSeleccionado)
    
    // Usar la función centralizada para validar y actualizar el documento
    const documentoValidado = validarDocumentoCliente(clienteSeleccionado)
    console.log('[handleClienteSelect] Documento validado:', documentoValidado)
    setDocumentoInfo(documentoValidado)
  }

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

  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const abrirSelector = () => setSelectorAbierto(true)
  const cerrarSelector = () => setSelectorAbierto(false)

  // Bloquear Enter
  const bloquearEnter = (e) => {
    if (e.key === "Enter") e.preventDefault()
  }

  // =========================
  // Seleccionar cliente mostrador por defecto (ID 1)
  // =========================
  useEffect(() => {
    if (!formulario.clienteId && clientesConDefecto.length > 0) {
      const mostrador = clientesConDefecto.find(c => String(c.id) === '1')
      if (mostrador) {
        setFormulario(prev => ({
          ...prev,
          clienteId: mostrador.id,
          cuit: mostrador.cuit || '',
          domicilio: mostrador.domicilio || '',
          plazoId: mostrador.plazoId || mostrador.plazo || '',
        }))
      }
    }
  }, [clientesConDefecto, formulario.clienteId, setFormulario])

  // ------------------------------------------------------------
  // Garantizar que autoSumarDuplicados tenga un valor por defecto
  // antes de la primera interacción (mismo comportamiento que VentaForm)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados("sumar")
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados])

  if (loadingAlicuotas) return <div>Cargando alícuotas de IVA...</div>
  if (errorAlicuotas) return <div>Error al cargar alícuotas de IVA: {errorAlicuotas}</div>

  // ---------- Spinner / Error antes del render principal ---------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando formulario...</p>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
          <div className="text-red-600 font-medium mb-2">Error al cargar</div>
          <p className="text-red-700 text-sm">{loadingError}</p>
        </div>
      </div>
    )
  }

  return (
    <form className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnter}>
      {/* Gradiente decorativo superior */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>
      <div className="px-8 pt-4 pb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          {initialData ? (isReadOnly ? "Ver Presupuesto" : "Editar Presupuesto") : "Nuevo Presupuesto"}
        </h3>
      {isReadOnly && (
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 border-l-4 border-amber-500 text-amber-900 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-medium">Este presupuesto está cerrado y no puede ser editado. Solo lectura.</span>
          </div>
        </div>
      )}

      {/* Una sola tarjeta con campos organizados en grid (igual a VentaForm) */}
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
                <div className="text-red-600 bg-red-50 rounded-none px-2 py-1 text-xs border border-red-200 h-8">
                  {errorClientes}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={(() => {
                      const cli = clientesConDefecto.find((c) => String(c.id) === String(formulario.clienteId))
                      return cli ? (cli.razon || cli.nombre) : ""
                    })()}
                    readOnly
                    disabled
                    className="flex-1 border border-slate-300 rounded-none px-2 py-1 text-xs h-8 bg-slate-100 text-slate-600 cursor-not-allowed"
                  />
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={abrirSelector}
                      className="p-1 rounded-none border border-slate-300 bg-white hover:bg-slate-100 transition-colors h-8 w-8 flex items-center justify-center"
                      title="Buscar en lista completa"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Documento */}
            <div>
              <SelectorDocumento
                tipoComprobante={"presupuesto"}
                esObligatorio={false}
                valorInicial={documentoInfo.valor}
                tipoInicial={documentoInfo.tipo}
                onChange={handleDocumentoChange}
                readOnly={isReadOnly}
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
                  return visibles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))
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
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Segunda fila: 3 campos */}
          <div className="grid grid-cols-3 gap-4 mb-3">
            {/* Buscador */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Buscador de Producto</label>
              <BuscadorProducto 
                productos={productos} 
                onSelect={handleAddItemToGrid} 
                disabled={isReadOnly}
                readOnly={isReadOnly}
                className="w-full"
              />
            </div>

            {/* Tipo de Comprobante */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Tipo de Comprobante *</label>
              <ComprobanteDropdown
                opciones={[{ value: 'presupuesto', label: 'Presupuesto', icon: 'document', codigo_afip: '9997' }]}
                value={'presupuesto'}
                onChange={() => {}}
                disabled={true}
                className="w-full"
              />
            </div>

            {/* Acción por defecto */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Acción por defecto</label>
              <SumarDuplicar
                autoSumarDuplicados={autoSumarDuplicados}
                setAutoSumarDuplicados={setAutoSumarDuplicados}
                disabled={isReadOnly}
                showLabel={false}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8">
        {(loadingProductos || loadingFamilias || loadingProveedores) && (
          <div className="text-center text-gray-500 py-2">Cargando productos, familias y proveedores...</div>
        )}
        {errorProductos && (
          <div className="text-center text-red-600 py-2">{errorProductos}</div>
        )}
        {errorFamilias && (
          <div className="text-center text-red-600 py-2">{errorFamilias}</div>
        )}
        {errorProveedores && (
          <div className="text-center text-red-600 py-2">{errorProveedores}</div>
        )}
        <ItemsGrid
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
          modo="presupuesto"
          alicuotas={alicuotasMap}
          onRowsChange={handleRowsChange}
          initialItems={formulario.items}
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
            className={`px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${theme.botonPrimario}`}
          >
            {initialData ? "Guardar Cambios" : "Crear Presupuesto"}
          </button>
        )}
      </div>
      {/* Modal selector clientes */}
      <ClienteSelectorModal
        abierto={selectorAbierto}
        onCerrar={cerrarSelector}
        clientes={clientesConDefecto}
        onSeleccionar={handleClienteSelect}
        cargando={loadingClientes}
        error={errorClientes}
      />
      </div>
    </form>
  )
}

export default PresupuestoForm
