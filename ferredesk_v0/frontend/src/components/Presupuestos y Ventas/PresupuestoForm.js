"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import ComprobanteDropdown from "../ComprobanteDropdown"
import { manejarCambioFormulario, manejarCambioCliente, manejarSeleccionClienteObjeto } from "./herramientasforms/manejoFormulario"
import { mapearCamposItem } from "./herramientasforms/mapeoItems"
import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
import { useCalculosFormulario } from './herramientasforms/useCalculosFormulario'
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { useFormularioDraft } from "./herramientasforms/useFormularioDraft"
import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"
import { normalizarItems } from './herramientasforms/normalizadorItems'

const getStockProveedoresMap = (productos) => {
  const map = {}
  productos.forEach((p) => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores
    }
  })
  return map
}

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
  return { ...defaults, ...data, items: Array.isArray(data?.items) ? data.items : [] }
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
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto()
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
  const normalizarItemsPresupuesto = (items) => {
    return normalizarItems(items, { 
      productos, 
      modo: 'presupuesto', 
      alicuotasMap 
    })
  }

  // Usar el hook useFormularioDraft
  const { formulario, setFormulario, limpiarBorrador, actualizarItems } = useFormularioDraft({
    claveAlmacenamiento: `presupuestoFormDraft_${tabKey}`,
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems: normalizarItemsPresupuesto,
  })

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap,
  })

  // handleRowsChange ahora usa actualizarItems
  const handleRowsChange = (rows) => {
    actualizarItems(rows)
  }

  const stockProveedores = useMemo(() => getStockProveedoresMap(productos), [productos])

  const itemsGridRef = useRef()

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

  // ------------------------------------------------------------
  // LOG DE DIAGNÓSTICO: comparar con VentaForm
  // ------------------------------------------------------------
  useEffect(() => {
    console.debug("[PresupuestoForm] stockProveedores listo", {
      loadingProductos,
      loadingProveedores,
      keys: Object.keys(stockProveedores || {}).length,
    })
  }, [loadingProductos, loadingProveedores, stockProveedores])

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
      limpiarBorrador() // Usar limpiarBorrador en lugar de localStorage.removeItem

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
          items: items.map((item, idx) => mapearCamposItem(item, idx)),
          permitir_stock_negativo: true,
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
          permitir_stock_negativo: true,
        }
        if (formulario.cuit) payload.ven_cuit = formulario.cuit;
        if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio;
      }

      await onSave(payload)
      onCancel()
    } catch (error) {
      console.error("Error al guardar presupuesto:", error)
    }
  }

  const handleCancel = () => {
    limpiarBorrador() // Usar limpiarBorrador en lugar de localStorage.removeItem
    onCancel()
  }

  const isReadOnly = readOnlyOverride || formulario.estado === "Cerrado"

  // Reemplazar handleChange por manejarCambioFormulario
  const handleChange = manejarCambioFormulario(setFormulario)

  const handleClienteSelect = manejarSeleccionClienteObjeto(setFormulario)

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
    <form className="venta-form w-full py-6 px-8 bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden" onSubmit={handleSubmit} onKeyDown={bloquearEnter}>
      {/* Gradiente decorativo superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>
      <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        {initialData ? (isReadOnly ? "Ver Presupuesto" : "Editar Presupuesto") : "Nuevo Presupuesto"}
      </h3>
      {isReadOnly && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-600 text-yellow-900 rounded">
          Este presupuesto/venta está cerrado y no puede ser editado. Solo lectura.
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
                value={(() => {
                  const cli = clientesConDefecto.find((c) => String(c.id) === String(formulario.clienteId))
                  return cli ? cli.razon || cli.nombre : ""
                })()}
                readOnly
                disabled
                className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-slate-100 text-slate-600 cursor-not-allowed"
              />
              {!isReadOnly && (
                <button type="button" onClick={abrirSelector} className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors" title="Buscar cliente">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 18.75l-3.5-3.5" /></svg>
                </button>
              )}
            </div>
          )}
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
      </div>
      {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
      <div className="mb-8">
        <div className="flex flex-row items-center gap-4 w-full mb-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 flex-wrap">
          {/* Buscador */}
          <div className="min-w-[260px] w-[260px]">
            <BuscadorProducto productos={productos} onSelect={handleAddItemToGrid} />
          </div>

          {/* Tipo comprobante */}
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

          {/* Acción duplicar / sumar */}
          <div className="w-56">
            <SumarDuplicar autoSumarDuplicados={autoSumarDuplicados} setAutoSumarDuplicados={setAutoSumarDuplicados} />
          </div>
        </div>
      </div>
      <div className="mb-8">
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
            ref={itemsGridRef}
            productosDisponibles={productos}
            proveedores={proveedores}
            stockProveedores={stockProveedores}
            autoSumarDuplicados={autoSumarDuplicados}
            setAutoSumarDuplicados={setAutoSumarDuplicados}
            bonificacionGeneral={formulario.bonificacionGeneral}
            setBonificacionGeneral={(value) => setFormulario((f) => ({ ...f, bonificacionGeneral: value }))}
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
          {isReadOnly ? "Cerrar" : "Cancelar"}
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
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
    </form>
  )
}

export default PresupuestoForm
