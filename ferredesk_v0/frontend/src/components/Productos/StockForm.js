"use client"

import { useState, useEffect, useRef } from "react"
import { useStockProveAPI, useStockProveEditAPI } from "../../utils/useStockProveAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import useDetectorDenominaciones from "../../utils/useDetectorDenominaciones"
import DenominacionSugerenciasTooltip from "./DenominacionSugerenciasTooltip"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import { BotonEditar } from "../Botones"

// Importar hooks modulares
import { 
  useStockForm, 
  useGestionProveedores, 
  useAsociacionCodigos,
  useGuardadoAtomico,
  useValidaciones 
} from "./herramientastockform"

// Función para obtener el token CSRF de la cookie
function getCookie(name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}

const StockForm = ({ stock, onSave, onCancel, proveedores, familias, modo }) => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()
  
  // Referencias
  const refContenedorDenominacion = useRef(null)
  
  // APIs existentes
  const stockProveAPI = useStockProveAPI()
  const stockProveEditAPI = useStockProveEditAPI()
  const isEdicion = !!stock?.id
  const { stockProve, updateStockProve, fetchStockProve } = isEdicion ? stockProveEditAPI : stockProveAPI
  const { alicuotas } = useAlicuotasIVAAPI()

  // Hook para detectar denominaciones similares
  const { sugerencias, isLoading: isLoadingSugerencias, error: errorSugerencias, mostrarTooltip, handleDenominacionBlur, limpiarSugerencias, toggleTooltip } = useDetectorDenominaciones()

  // Hooks modulares
  const { 
    form, 
    setForm, 
    formError, 
    setFormError, 
    handleChange, 
    updateForm, 
    handleCancel 
  } = useStockForm({ stock, modo, onSave, onCancel })
  
  const {
    stockProvePendientes,
    setStockProvePendientes,
    codigosPendientes,
    setCodigosPendientes,
    proveedoresAgregados,
    setProveedoresAgregados,
    codigosPendientesEdicion,
    setCodigosPendientesEdicion,
    newStockProve,
    setNewStockProve,
    editandoCantidadId,
    nuevaCantidad,
    setNuevaCantidad,
    editandoCostoId,
    nuevoCosto,
    setNuevoCosto,
    editandoCantidadProveedorId,
    nuevaCantidadProveedor,
    setNuevaCantidadProveedor,
    editandoCostoProveedorId,
    nuevoCostoProveedor,
    setNuevoCostoProveedor,
    handleNewStockProveChange,
    handleAgregarProveedorEdicion,
    handleAgregarProveedor,
    handleEliminarProveedorEdicion,
    handleEliminarProveedor,
    handleEditarCantidadProveedor,
    handleEditarCantidadProveedorSave,
    handleEditarCantidadProveedorCancel,
    handleEditarCostoProveedor,
    handleEditarCostoProveedorSave,
    handleEditarCostoProveedorCancel,
    handleEditStockProve,
    handleEditCostoStockProve,
    handleEditStockProveCancel,
    handleEditStockProveSave,
    handleEditCostoStockProveSave,
    stockTotal,
    proveedoresAsociados,
    stockProveParaMostrar,
    stockProveForThisStock
  } = useGestionProveedores({ 
    stock, 
    modo, 
    proveedores, 
    stockProve, 
    form, 
    updateForm, 
    setFormError,
    updateStockProve,
    fetchStockProve
  })
  
  const {
    selectedProveedor,
    setSelectedProveedor,
    codigoProveedor,
    setCodigoProveedor,
    productosConDenominacion,
    loadingCodigos,
    messageAsociar,
    errorAsociar,
    costoAsociar,
    denominacionAsociar,
    cargandoCostoAsociar,
    showSugeridos,
    setShowSugeridos,
    modoBusqueda,
    setModoBusqueda,
    filteredProductos,
    handleAsociarCodigoIntegrado,
    handleCancelarAsociarCodigo
  } = useAsociacionCodigos({
    stock,
    modo,
    form,
    stockProve,
    codigosPendientes,
    setCodigosPendientes,
    codigosPendientesEdicion,
    setCodigosPendientesEdicion,
    stockProvePendientes,
    setStockProvePendientes,
    proveedoresAgregados,
    setProveedoresAgregados,
    updateForm,
    setFormError
  })
  
  const { guardarProductoAtomico } = useGuardadoAtomico({ modo, stock, stockProve, onSave })
  
  const { esValido } = useValidaciones({
    form,
    modo,
    stockProveParaMostrar,
    codigosPendientes,
    codigosPendientesEdicion
  })
  
  // Estados adicionales que no están en los hooks
  const [showAsociarCodigo, setShowAsociarCodigo] = useState(false)
  const [mostrarTooltipStock, setMostrarTooltipStock] = useState(false)

  

  useEffect(() => {
    if (stock) {
      // Construir stock_proveedores para edición con solo proveedor_id
      const stockProveedores =
        stock.stock_proveedores && stock.stock_proveedores.length > 0
          ? stock.stock_proveedores.map((sp) => ({
              ...sp,
              proveedor_id: sp.proveedor_id || (sp.proveedor && (sp.proveedor.id || sp.proveedor)),
            }))
          : stockProve
              .filter((sp) => sp.stock === stock.id)
              .map((sp) => ({
                proveedor_id: sp.proveedor?.id || sp.proveedor,
                cantidad: sp.cantidad,
                costo: sp.costo,
                codigo_producto_proveedor: sp.codigo_producto_proveedor || "",
              }))

      setForm({
        codvta: stock.codvta || "",
        codcom: stock.codcom || "",
        deno: stock.deno || "",
        unidad: stock.unidad || "",
        cantmin: stock.cantmin || 0,
        proveedor_habitual_id:
          stock.proveedor_habitual && typeof stock.proveedor_habitual === "object"
            ? String(stock.proveedor_habitual.id)
            : stock.proveedor_habitual && typeof stock.proveedor_habitual === "string"
              ? stock.proveedor_habitual
              : "",
        idfam1: stock.idfam1 && typeof stock.idfam1 === "object" ? stock.idfam1.id : (stock.idfam1 ?? null),
        idfam2: stock.idfam2 && typeof stock.idfam2 === "object" ? stock.idfam2.id : (stock.idfam2 ?? null),
        idfam3: stock.idfam3 && typeof stock.idfam3 === "object" ? stock.idfam3.id : (stock.idfam3 ?? null),
        idaliiva: stock.idaliiva && typeof stock.idaliiva === "object" ? stock.idaliiva.id : (stock.idaliiva ?? ""),
        margen: stock.margen !== undefined && stock.margen !== null ? String(stock.margen) : "",
        acti: stock.acti !== undefined && stock.acti !== null ? String(stock.acti) : "",
        id: stock.id,
        stock_proveedores: stockProveedores,
      })
      setNewStockProve((prev) => ({ ...prev, stock: stock.id }))
    }
  }, [stock, stockProve, setForm, setNewStockProve])

  useEffect(() => {
    if (modo === "nuevo" && !stock) {
      localStorage.setItem("stockFormDraft", JSON.stringify(form))
    }
  }, [form, stock, modo])

  useEffect(() => {
    if (modo === "nuevo" && !form.id) {
      fetch("/api/productos/obtener-nuevo-id-temporal/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.id) {
            setForm((prev) => ({ ...prev, id: data.id }))
            setNewStockProve((prev) => ({ ...prev, stock: data.id }))
          }
        })
    }
  }, [modo, form.id, setForm, setNewStockProve])

  useEffect(() => {
    let detectado = false
    const proveedorId = newStockProve.proveedor
    if (!proveedorId) {
      return
    }

    if (isEdicion) {
      // 1) Verificar en los registros guardados
      const relacion = stockProve.find(
        (sp) =>
          String(sp.stock?.id || sp.stock) === String(stock?.id) &&
          String(sp.proveedor?.id || sp.proveedor) === String(proveedorId) &&
          sp.codigo_producto_proveedor,
      )
      if (relacion) detectado = true

      // 2) Verificar en los códigos pendientes de la sesión de edición
      const pendiente = codigosPendientesEdicion.find(
        (c) => String(c.proveedor_id) === String(proveedorId) && c.codigo_producto_proveedor,
      )
      if (pendiente) detectado = true

      // 3) Verificar en el estado local del formulario (puede haberse actualizado)
      if (!detectado && Array.isArray(form.stock_proveedores)) {
        const spLocal = form.stock_proveedores.find(
          (sp) => String(sp.proveedor_id) === String(proveedorId) && sp.codigo_producto_proveedor,
        )
        if (spLocal) detectado = true
      }
    } else {
      // Modo nuevo: verificar en los códigos pendientes
      const codigoPendiente = codigosPendientes.find(
        (c) => String(c.proveedor_id) === String(proveedorId) && c.codigo_producto_proveedor,
      )
      if (codigoPendiente) detectado = true
    }
  }, [newStockProve.proveedor, stockProve, codigosPendientes, codigosPendientesEdicion, form.stock_proveedores, isEdicion, stock?.id])










  // Función de guardado usando el hook modular
  const handleSave = async (e) => {
    e.preventDefault()
    
    // Validar el formulario antes de guardar
    if (!esValido) {
      setFormError("Por favor corrija los errores en el formulario antes de guardar.")
      return
    }
    
    // Usar el hook de guardado atómico (maneja todo internamente)
    const resultado = await guardarProductoAtomico(
      form,
      stockProvePendientes,
      codigosPendientes,
      proveedoresAgregados,
      codigosPendientesEdicion,
      setFormError,
      setStockProvePendientes,
      setCodigosPendientes,
      setProveedoresAgregados,
      setCodigosPendientesEdicion,
      fetchStockProve
    )
    
    if (resultado.success) {
      // Limpiar localStorage
      localStorage.removeItem("stockFormDraft")
    }
  }









  console.log("form state:", JSON.stringify(form))
  console.log("select value:", form.proveedor_habitual_id)

  // Calcular si hay un solo proveedor
  const unProveedor = proveedoresAsociados.length === 1

  // Si hay un solo proveedor, autocompletar y deshabilitar
  useEffect(() => {
    if (unProveedor && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm((prev) => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }))
    }
  }, [unProveedor, proveedoresAsociados, form.proveedor_habitual_id, setForm])



  // Al asociar stock, autocompletar proveedor habitual si hay uno solo
  useEffect(() => {
    if (proveedoresAsociados.length === 1 && form.proveedor_habitual_id !== String(proveedoresAsociados[0].id)) {
      setForm((prev) => ({ ...prev, proveedor_habitual_id: String(proveedoresAsociados[0].id) }))
    }
  }, [proveedoresAsociados, form.proveedor_habitual_id, setForm])

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 p-4">
      <div className="w-full max-w-none">
        <form
          className="w-full bg-white rounded-2xl shadow-md border border-slate-200/50 relative overflow-visible"
          onSubmit={handleSave}
        >
          {/* Gradiente decorativo superior */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.primario}`}></div>

          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {stock && stock.id ? "Editar Producto" : "Nuevo Producto"}
                </h3>
              </div>

              {/* Mensajes de error */}
              {formError && (
                <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formError}
                  </div>
                </div>
              )}
            </div>

            {/* Header compacto con denominación */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 truncate" title={form.deno}>
                {form.deno || "Nuevo Producto"}
              </div>
            </div>

            {/* Tarjetas horizontales al estilo del detalle */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {/* Tarjeta Información Básica */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]">
                <h5 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Información Básica
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Código Venta *</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="text"
                        name="codvta"
                        value={form.codvta}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Código Compra *</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="text"
                        name="codcom"
                        value={form.codcom}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Denominación *</span>
                    <div className="min-w-[180px] text-right">
                      <div className="relative" ref={refContenedorDenominacion}>
                        <input
                          type="text"
                          name="deno"
                          value={form.deno}
                          onChange={handleChange}
                          onBlur={modo === "nuevo" ? (e) => handleDenominacionBlur(e.target.value) : undefined}
                          className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 pr-8"
                          required
                        />
                        {modo === "nuevo" && sugerencias && !isLoadingSugerencias && !errorSugerencias && (
                          <button
                            type="button"
                            onClick={toggleTooltip}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-orange-600 hover:text-orange-800 transition-colors"
                            title="Ver productos similares"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {modo === "nuevo" && (sugerencias || isLoadingSugerencias || errorSugerencias) && (
                        <DenominacionSugerenciasTooltip
                          sugerencias={sugerencias}
                          onIgnorar={limpiarSugerencias}
                          isLoading={isLoadingSugerencias}
                          error={errorSugerencias}
                          mostrarTooltip={mostrarTooltip}
                          onToggle={toggleTooltip}
                          targetRef={refContenedorDenominacion}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Unidad</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="text"
                        name="unidad"
                        value={form.unidad}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Estado</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="acti"
                        value={form.acti ?? ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        required
                      >
                        <option value="">Sin asignar</option>
                        <option value="S">Activo</option>
                        <option value="N">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta Códigos y Proveedores */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]">
                <h5 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Códigos y Proveedores
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Proveedor Habitual</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="proveedor_habitual_id"
                        value={form.proveedor_habitual_id ?? ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        disabled={proveedoresAsociados.length === 1}
                        required={proveedoresAsociados.length > 1}
                      >
                        <option value="">Seleccionar...</option>
                        {proveedoresAsociados.map((prov) => (
                          <option key={prov.id} value={String(prov.id)}>
                            {prov.razon}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {(stock?.id || form.id) && (
                    <div className="py-2">
                      <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-slate-700">Asociar Código</span>
                      <div className="min-w-[180px] text-right">
                        <button
                          type="button"
                            onClick={() => setShowAsociarCodigo(!showAsociarCodigo)}
                          className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                            {showAsociarCodigo ? "Ocultar" : "Asociar código"}
                        </button>
                      </div>
                      </div>
                      
                      {/* Componente integrado de asociar código */}
                      {showAsociarCodigo && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3">
                          {/* Mensajes */}
                          {errorAsociar && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs flex items-center gap-2">
                              <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {errorAsociar}
                    </div>
                  )}
                  
                          {messageAsociar && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-xs flex items-center gap-2">
                              <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              {messageAsociar}
                            </div>
                          )}

                          {/* Proveedor */}
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Proveedor
                            </label>
                            <select
                              value={selectedProveedor}
                              onChange={(e) => setSelectedProveedor(e.target.value)}
                              className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            >
                              <option value="">Seleccione un proveedor</option>
                              {proveedores.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.razon}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Selector de modo de búsqueda */}
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs text-slate-700">
                              <input
                                type="radio"
                                name="modoBusqueda"
                                value="codigo"
                                checked={modoBusqueda === "codigo"}
                                onChange={() => setModoBusqueda("codigo")}
                                className="accent-orange-600"
                              />
                              Por código
                            </label>
                            <label className="flex items-center gap-1 text-xs text-slate-700">
                              <input
                                type="radio"
                                name="modoBusqueda"
                                value="denominacion"
                                checked={modoBusqueda === "denominacion"}
                                onChange={() => setModoBusqueda("denominacion")}
                                className="accent-orange-600"
                              />
                              Por denominación
                            </label>
                          </div>

                          {/* Input de búsqueda */}
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              {modoBusqueda === "codigo" ? "Código del proveedor" : "Denominación del producto"}
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={codigoProveedor}
                                onChange={(e) => {
                                  setCodigoProveedor(e.target.value)
                                  setShowSugeridos(e.target.value.length > 0 && productosConDenominacion.length > 0)
                                }}
                                onFocus={() => setShowSugeridos(codigoProveedor.length > 0 && productosConDenominacion.length > 0)}
                                className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-8"
                                placeholder={modoBusqueda === "codigo" ? "Ingrese el código" : "Ingrese la denominación"}
                                disabled={loadingCodigos || !selectedProveedor}
                              />
                              {productosConDenominacion.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowSugeridos(!showSugeridos)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                                >
                                  <svg
                                    className={`w-3 h-3 transition-transform ${showSugeridos ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {/* Dropdown de sugerencias */}
                            {showSugeridos && filteredProductos.length > 0 && (
                              <div className="absolute z-10 w-auto max-w-[600px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-20 overflow-y-auto">
                                {filteredProductos.map((producto, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                      setCodigoProveedor(producto.codigo)
                                      setShowSugeridos(false)
                                    }}
                                    className="w-full text-left px-2 py-1 hover:bg-orange-50 hover:text-orange-700 transition-colors text-[12px] border-b border-slate-100 last:border-b-0"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-slate-800">{producto.codigo}</span>
                                      {producto.denominacion && (
                                        <span className="text-slate-600 truncate flex-1">
                                          {producto.denominacion}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {loadingCodigos && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                <div className="w-2 h-2 border border-slate-300 border-t-orange-500 rounded-full animate-spin"></div>
                                Cargando códigos...
                              </div>
                            )}
                          </div>

                          {/* Información del producto */}
                          {(codigoProveedor || denominacionAsociar || costoAsociar) && (
                            <div className="bg-blue-50 rounded p-2 border border-blue-200">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-12">Código:</span>
                                  <span className="text-xs font-mono bg-white px-1 py-0.5 rounded border text-slate-800">
                                    {codigoProveedor || "—"}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-12">Denom.:</span>
                                  <span className="text-xs bg-white px-1 py-0.5 rounded border text-slate-800 flex-1">
                                    {denominacionAsociar || "—"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 w-12">Costo:</span>
                                  <span className="text-xs font-mono bg-white px-1 py-0.5 rounded border text-green-700">
                                    {costoAsociar ? `$${costoAsociar}` : "—"}
                                  </span>
                                  {cargandoCostoAsociar && (
                                    <div className="w-2 h-2 border border-slate-300 border-t-orange-500 rounded-full animate-spin"></div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botones */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCancelarAsociarCodigo}
                              className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleAsociarCodigoIntegrado}
                              disabled={!selectedProveedor || !codigoProveedor}
                              className="flex-1 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Asociar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Formulario para agregar proveedor */}
                  {(modo === "nuevo" || isEdicion) && (
                  <div className="py-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="text-[12px] text-slate-700">Agregar Proveedor</div>
                      <div
                        className="relative cursor-pointer"
                        onMouseEnter={() => setMostrarTooltipStock(true)}
                        onMouseLeave={() => setMostrarTooltipStock(false)}
                      >
                        <div className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="w-2.5 h-2.5 text-slate-600"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                          </svg>
                        </div>
                        {mostrarTooltipStock && (
                          <div className="absolute left-6 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl w-[450px]">
                              Agregue proveedores para este producto. La cantidad y costo se pueden editar directamente en la sección "Stock por Proveedor"
                            <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <select
                          name="proveedor"
                          value={
                            typeof newStockProve.proveedor === "string" || typeof newStockProve.proveedor === "number"
                              ? newStockProve.proveedor
                              : ""
                          }
                          onChange={handleNewStockProveChange}
                          className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                            <option value="">Seleccionar proveedor...</option>
                            {proveedores
                              .filter((proveedor) => {
                                if (modo === "nuevo") {
                                  return !proveedoresAgregados.some((pa) => pa.proveedor === proveedor.id)
                                } else {
                                  // En modo edición, filtrar por stockProveForThisStock y codigosPendientesEdicion
                                  const existeEnStock = stockProveForThisStock.some((sp) => 
                                    String(sp.proveedor?.id || sp.proveedor) === String(proveedor.id)
                                  )
                                  const existeEnPendientes = codigosPendientesEdicion.some((c) => 
                                    String(c.proveedor_id) === String(proveedor.id)
                                  )
                                  return !existeEnStock && !existeEnPendientes
                                }
                              })
                              .map((proveedor) => (
                            <option key={proveedor.id} value={String(proveedor.id)}>
                              {proveedor.razon}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={isEdicion ? handleAgregarProveedorEdicion : handleAgregarProveedor}
                        className={`w-full px-2 py-1 ${theme.botonPrimario} text-xs`}
                      >
                          Agregar Proveedor
                      </button>
                      </div>
                        </div>
                      )}
                </div>
              </div>

              {/* Tarjeta Stock y Costos */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]">
                <h5 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Stock y Costos
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Stock Total</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="number"
                        value={stockTotal}
                        readOnly
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 bg-slate-100 text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Cantidad Mínima</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="number"
                        name="cantmin"
                        value={form.cantmin}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Margen (%)</span>
                    <div className="min-w-[180px] text-right">
                      <input
                        type="number"
                        name="margen"
                        value={form.margen ?? ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        step="0.01"
                        min="0"
                        placeholder="% ganancia"
                      />
                    </div>
                  </div>

                  
                  {/* Stock Actual por Proveedor */}
                  {((stock && stock.id) || (!stock?.id && (stockProvePendientes.length > 0 || proveedoresAgregados.length > 0))) && (
                    <div className="pt-2 border-t border-slate-200">
                      <h6 className="text-[12px] font-semibold text-slate-700 mb-2">Stock por Proveedor</h6>
                      <div className="space-y-2">
                        {stockProveParaMostrar.map((sp, index) => {
                          // Buscar código pendiente si corresponde
                          let codigoProveedor = sp.codigo_producto_proveedor
                          if (!codigoProveedor && !stock?.id) {
                            const codigoPendiente = codigosPendientes.find(
                              (c) => String(c.proveedor_id) === String(sp.proveedor.id || sp.proveedor),
                            )
                            if (codigoPendiente) {
                              codigoProveedor = codigoPendiente.codigo_producto_proveedor
                            }
                          }

                          // Determinar si es un proveedor agregado en modo nuevo
                          const esProveedorAgregado = modo === "nuevo" && sp.id && String(sp.id).startsWith("agregado-")
                          // En edición: proveedores agregados (pendiente-*) o proveedores existentes con cambios pendientes
                          const esProveedorAgregadoEdicion = isEdicion && sp.pendiente && (
                            (sp.id && String(sp.id).startsWith("pendiente-") && !sp.codigo_producto_proveedor) || // Proveedores agregados
                            (sp.id && !String(sp.id).startsWith("pendiente-") && sp.id && !String(sp.id).startsWith("agregado-")) // Proveedores existentes con cambios
                          )
                          const proveedorId = esProveedorAgregado ? (typeof sp.proveedor === 'object' ? sp.proveedor.id : sp.proveedor) : (sp.proveedor?.id || sp.proveedor)

                          return (
                            <div
                              key={sp.id || index}
                              className={`p-2 rounded-sm border ${sp.pendiente ? "bg-yellow-50 border-yellow-300" : "bg-slate-50 border-slate-200"}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[12px] font-semibold text-slate-700">
                                    {typeof sp.proveedor === "object"
                                      ? sp.proveedor.razon
                                      : proveedores.find((p) => p.id === sp.proveedor)?.razon || sp.proveedor}
                                  </span>
                                  {(esProveedorAgregado || esProveedorAgregadoEdicion) && (
                                    <button
                                      type="button"
                                      onClick={() => isEdicion ? handleEliminarProveedorEdicion(proveedorId) : handleEliminarProveedor(proveedorId)}
                                      className="text-red-600 hover:text-red-800 text-xs"
                                      title="Eliminar proveedor"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[12px] text-slate-700">
                                  <span>
                                    Código: <span className="font-medium text-xs">{codigoProveedor || "N/A"}</span>
                                  </span>
                                  <span>
                                    <span className="flex items-center gap-1">
                                      Cantidad:
                                      {!esProveedorAgregado && !esProveedorAgregadoEdicion && !editandoCantidadId && (
                                        <BotonEditar
                                          onClick={() => handleEditStockProve(sp)}
                                        />
                                      )}
                                      {(esProveedorAgregado || esProveedorAgregadoEdicion) && !editandoCantidadProveedorId && (
                                        <BotonEditar
                                          onClick={() => handleEditarCantidadProveedor(proveedorId)}
                                        />
                                      )}
                                    </span>{" "}
                                    {(esProveedorAgregado || esProveedorAgregadoEdicion) ? (
                                      editandoCantidadProveedorId === proveedorId ? (
                                        <div className="inline-flex items-center gap-2">
                                          <input
                                            type="number"
                                            value={nuevaCantidadProveedor}
                                            onChange={(e) => setNuevaCantidadProveedor(e.target.value)}
                                            className="w-20 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            min="0"
                                            step="0.01"
                                          />
                                          <button
                                            type="button"
                                            className="px-2 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 text-xs"
                                            onClick={() => handleEditarCantidadProveedorSave(proveedorId)}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2 py-1 bg-slate-400 text-white rounded-sm hover:bg-slate-500 text-xs"
                                            onClick={handleEditarCantidadProveedorCancel}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="font-medium text-xs">{sp.cantidad}</span>
                                      )
                                    ) : editandoCantidadId === sp.id ? (
                                      <div className="inline-flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={nuevaCantidad}
                                          onChange={(e) => setNuevaCantidad(e.target.value)}
                                          className="w-20 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                          min="0"
                                        />
                                        <button
                                          type="button"
                                          className="px-2 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 text-xs"
                                          onClick={() => handleEditStockProveSave(sp.id)}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          className="px-2 py-1 bg-slate-400 text-white rounded-sm hover:bg-slate-500 text-xs"
                                          onClick={handleEditStockProveCancel}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                        <span className="font-medium text-xs">{sp.cantidad}</span>
                                    )}
                                  </span>
                                  <span>
                                    <span className="flex items-center gap-1">
                                      Costo:
                                      {!esProveedorAgregado && !esProveedorAgregadoEdicion && !editandoCostoId && (
                                        <BotonEditar
                                          onClick={() => handleEditCostoStockProve(sp)}
                                        />
                                      )}
                                      {(esProveedorAgregado || esProveedorAgregadoEdicion) && !editandoCostoProveedorId && (
                                        <BotonEditar
                                          onClick={() => handleEditarCostoProveedor(proveedorId)}
                                        />
                                      )}
                                    </span>{" "}
                                    {(esProveedorAgregado || esProveedorAgregadoEdicion) ? (
                                      editandoCostoProveedorId === proveedorId ? (
                                        <div className="inline-flex items-center gap-2">
                                          <input
                                            type="number"
                                            value={nuevoCostoProveedor}
                                            onChange={(e) => setNuevoCostoProveedor(e.target.value)}
                                            className="w-24 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            min="0"
                                            step="0.01"
                                          />
                                          <button
                                            type="button"
                                            className="px-2 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 text-xs"
                                            onClick={() => handleEditarCostoProveedorSave(proveedorId)}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2 py-1 bg-slate-400 text-white rounded-sm hover:bg-slate-500 text-xs"
                                            onClick={handleEditarCostoProveedorCancel}
                                          >
                                            ✕
                                          </button>
                                      </div>
                                      ) : (
                                        <span className="font-medium text-xs">${sp.costo}</span>
                                      )
                                    ) : editandoCostoId === sp.id ? (
                                      <div className="inline-flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={nuevoCosto}
                                          onChange={(e) => setNuevoCosto(e.target.value)}
                                          className="w-24 border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                          min="0"
                                          step="0.01"
                                        />
                                        <button
                                          type="button"
                                          className="px-2 py-1 bg-green-600 text-white rounded-sm hover:bg-green-700 text-xs"
                                          onClick={() => handleEditCostoStockProveSave(sp.id)}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          className="px-2 py-1 bg-slate-400 text-white rounded-sm hover:bg-slate-500 text-xs"
                                          onClick={handleEditStockProveCancel}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="font-medium text-xs">${sp.costo}</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta Categorización */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]">
                <h5 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
                  </svg>
                  Categorización
                </h5>
                <div className="divide-y divide-slate-200">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Familia</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="idfam1"
                        value={typeof form.idfam1 === "number" || typeof form.idfam1 === "string" ? form.idfam1 : ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Sin familia</option>
                        {familias
                          .filter((fam) => String(fam.nivel) === "1")
                          .map((fam) => (
                            <option key={fam.id} value={fam.id}>
                              {fam.deno}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Subfamilia</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="idfam2"
                        value={typeof form.idfam2 === "number" || typeof form.idfam2 === "string" ? form.idfam2 : ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Sin subfamilia</option>
                        {familias
                          .filter((fam) => String(fam.nivel) === "2")
                          .map((fam) => (
                            <option key={fam.id} value={fam.id}>
                              {fam.deno}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Sub-subfamilia</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="idfam3"
                        value={typeof form.idfam3 === "number" || typeof form.idfam3 === "string" ? form.idfam3 : ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Sin sub-subfamilia</option>
                        {familias
                          .filter((fam) => String(fam.nivel) === "3")
                          .map((fam) => (
                            <option key={fam.id} value={fam.id}>
                              {fam.deno}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Alícuota IVA *</span>
                    <div className="min-w-[180px] text-right">
                      <select
                        name="idaliiva"
                        value={typeof form.idaliiva === "number" || typeof form.idaliiva === "string" ? form.idaliiva : ""}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {alicuotas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.deno} ({a.porce}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Botones de acción */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-medium shadow-sm hover:shadow-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-6 py-3 ${theme.botonPrimario} rounded-xl`}
              >
                {stock && stock.id ? "Actualizar Producto" : "Guardar Producto"}
              </button>
            </div>
          </div>
        </form>
      </div>


    </div>
  )
}

export default StockForm;
