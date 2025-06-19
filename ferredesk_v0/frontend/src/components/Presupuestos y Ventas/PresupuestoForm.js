"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import ComprobanteDropdown from "../ComprobanteDropdown"
import { manejarCambioFormulario, manejarCambioCliente } from "./herramientasforms/manejoFormulario"
import { mapearCamposItem } from "./herramientasforms/mapeoItems"
import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
import { useCalculosFormulario, TotalesVisualizacion } from './herramientasforms/useCalculosFormulario'
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { useFormularioDraft } from "./herramientasforms/useFormularioDraft"

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
}) => {
  const { clientes, loading: loadingClientes, error: errorClientes } = useClientesConDefecto()
  const { alicuotas, loading: loadingAlicuotas, error: errorAlicuotas } = useAlicuotasIVAAPI()

  // Función para normalizar items
  const normalizarItems = (items) => {
    return items.map((item, idx) => {
      // Si ya tiene producto, dejarlo
      if (item.producto) return { ...item, id: item.id || idx + 1 }
      // Buscar producto por código si es posible
      let prod = null
      if (item.codigo || item.codvta) {
        prod = productos.find((p) => (p.codvta || p.codigo)?.toString() === (item.codigo || item.codvta)?.toString())
      }
      return {
        id: item.id || idx + 1,
        producto: prod || undefined,
        codigo: item.codigo || item.codvta || (prod ? prod.codvta || prod.codigo : ""),
        denominacion: item.denominacion || item.nombre || (prod ? prod.deno || prod.nombre : ""),
        unidad: item.unidad || item.unidadmedida || (prod ? prod.unidad || prod.unidadmedida : ""),
        cantidad: item.cantidad || 1,
        costo: item.costo || item.precio || (prod ? prod.precio || prod.preciovta || prod.preciounitario : 0),
        bonificacion: item.vdi_bonifica || 0,
        subtotal: item.subtotal || 0,
      }
    })
  }

  // Usar el hook useFormularioDraft
  const { formulario, setFormulario, limpiarBorrador, actualizarItems } = useFormularioDraft({
    claveAlmacenamiento: "presupuestoFormDraft",
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems,
  })

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

  const stockProveedores = getStockProveedoresMap(productos)

  const itemsGridRef = useRef()

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

  // Efecto para seleccionar automáticamente Cliente Mostrador (ID 1)
  useEffect(() => {
    if (!formulario.clienteId && clientes.length > 0) {
      const mostrador = clientes.find((c) => String(c.id) === "1")
      if (mostrador) {
        setFormulario((prev) => ({
          ...prev,
          clienteId: mostrador.id,
          cuit: mostrador.cuit || "",
          domicilio: mostrador.domicilio || "",
          plazoId: mostrador.plazoId || mostrador.plazo || "",
        }))
      }
    }
  }, [clientes, formulario.clienteId, setFormulario])

  // Inicializar el estado correctamente
  const [autoSumarDuplicados, setAutoSumarDuplicados] = useState("sumar")
  const [mostrarTooltipDescuentos, setMostrarTooltipDescuentos] = useState(false)

  if (loadingAlicuotas) return <div>Cargando alícuotas de IVA...</div>
  if (errorAlicuotas) return <div>Error al cargar alícuotas de IVA: {errorAlicuotas}</div>

  return (
    <form className="w-full py-6 px-8 bg-white rounded-xl shadow relative" onSubmit={handleSubmit}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {initialData ? (isReadOnly ? "Ver Presupuesto" : "Editar Presupuesto") : "Nuevo Presupuesto"}
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
              onChange={manejarCambioCliente(setFormulario, clientes)}
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
        {/* Fila 3 */}
        <div className="col-start-1 row-start-3 flex flex-col justify-end">
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Tipo de Comprobante</label>
          <ComprobanteDropdown
            opciones={[{ value: "presupuesto", label: "Presupuesto", icon: "document", codigo_afip: "9997" }]}
            value={"presupuesto"}
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
    </form>
  )
}

export default PresupuestoForm
