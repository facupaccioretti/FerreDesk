"use client"

import { useState, useEffect, useRef } from "react"
import { useStockProveAPI } from "../../utils/useStockProveAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import { useFerreteriaAPI } from "../../utils/useFerreteriaAPI"
import useDetectorDenominaciones from "../../utils/useDetectorDenominaciones"
import DenominacionSugerenciasTooltip from "./DenominacionSugerenciasTooltip"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"
import useNavegacionForm from "../../hooks/useNavegacionForm"
import { BotonEditar } from "../Botones"
import { useListasPrecioAPI, usePreciosProductoListaAPI } from "../../utils/useListasPrecioAPI"
import { calcularPrecioLista, calcularPrecioLista0, calcularMargenDesdePrecios } from "../../utils/calcularPrecioLista"

// Importar hooks modulares
import { 
  useStockForm, 
  useGestionProveedores, 
  useAsociacionCodigos,
  useGuardadoAtomico,
  useValidaciones 
} from "./herramientastockform"

// Importar módulo de códigos de barras
import { CodigoBarrasModal } from "./codigoBarras"

// Constantes de validación de campos (evitar valores mágicos)
// Longitudes máximas según el modelo en backend (productos/models.py)
const LONGITUD_MAX_CODIGO_VENTA = 15 // Stock.codvta CharField(max_length=15)
const LONGITUD_MAX_DENOMINACION = 50 // Stock.deno CharField(max_length=50)
const LONGITUD_MAX_UNIDAD = 10 // Stock.unidad CharField(max_length=10)
const LONGITUD_MAX_CODIGO_PROVEEDOR = 100 // StockProve.codigo_producto_proveedor CharField(max_length=100)

// Límites para márgen y cantidad mínima
const MARGEN_MINIMO = 0
const MARGEN_MAXIMO = 999.99 // DecimalField(max_digits=5, decimal_places=2)
const MARGEN_STEP = 0.01
const CANTIDAD_MINIMA_MINIMO = 0

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

const StockForm = ({ stock, onSave, onCancel, proveedores, familias, modo, tabKey }) => {
  // Hook del tema de FerreDesk
  const theme = useFerreDeskTheme()
  
  // Hook para navegación entre campos con Enter
  const { getFormProps } = useNavegacionForm()
  
  // Referencias
  const refContenedorDenominacion = useRef(null)
  const referenciaCampoBusqueda = useRef(null)
  
  // APIs existentes
  const isEdicion = !!stock?.id
  // Evitar fetch global de stockprove en edición: solo en modo "nuevo" usamos el hook
  const stockProveAPI = useStockProveAPI()
  const stockProve = isEdicion ? [] : stockProveAPI.stockProve
  const updateStockProve = isEdicion ? async () => {} : stockProveAPI.updateStockProve
  const fetchStockProve = isEdicion ? async () => {} : stockProveAPI.fetchStockProve
  const { alicuotas } = useAlicuotasIVAAPI()

  // Hook para obtener la configuración de la ferretería
  const { ferreteria } = useFerreteriaAPI()

  // Hook para detectar denominaciones similares
  const { sugerencias, isLoading: isLoadingSugerencias, error: errorSugerencias, mostrarTooltip, handleDenominacionBlur, limpiarSugerencias, toggleTooltip } = useDetectorDenominaciones()

  // Hooks para listas de precios
  const { listas: listasPrecio } = useListasPrecioAPI()
  const { guardarPreciosProducto } = usePreciosProductoListaAPI()

  // Estados para precios de listas
  const [preciosListas, setPreciosListas] = useState({
    lista0: { precio: '', manual: false },
    lista1: { precio: '', manual: false },
    lista2: { precio: '', manual: false },
    lista3: { precio: '', manual: false },
    lista4: { precio: '', manual: false },
  })
  
  // Estado para tooltips de precios manuales
  const [mostrarTooltipPrecioManual, setMostrarTooltipPrecioManual] = useState(null)

  // Hooks modulares
  const { 
    form, 
    setForm, 
    setFormError, 
    handleChange, 
    updateForm, 
    handleCancel,
    claveBorrador
  } = useStockForm({ stock, modo, onSave, onCancel, tabKey })
  
  const {
    stockProvePendientes,
    setStockProvePendientes,
    codigosPendientes,
    setCodigosPendientes,
    proveedoresAgregados,
    setProveedoresAgregados,
    codigosPendientesEdicion,
    setCodigosPendientesEdicion,
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
    setErrorAsociar,
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
  
  const { esValido, errores, erroresCampo } = useValidaciones({
    form,
    modo,
    stockProveParaMostrar,
    codigosPendientes,
    codigosPendientesEdicion,
    ferreteria
  })
  
  // Estados adicionales que no están en los hooks
  const [showAsociarCodigo, setShowAsociarCodigo] = useState(false)
  const [mostrarTooltipStock, setMostrarTooltipStock] = useState(false)
  const [showCodigoBarrasModal, setShowCodigoBarrasModal] = useState(false)
  
  // El código de barras se guarda en form para persistir entre cambios de pestaña
  // Usamos form como fuente de verdad, con fallback a stock (valor de BD)
  const codigoBarrasEfectivo = form.codigo_barras ?? stock?.codigo_barras ?? null
  const tipoCodigoBarrasEfectivo = form.tipo_codigo_barras ?? stock?.tipo_codigo_barras ?? null
  
  // Callback cuando el modal cambia el código
  const handleCodigoBarrasChange = (codigo, tipo) => {
    // Actualizar el form para que se guarde con el producto y persista entre pestañas
    updateForm({
      codigo_barras: codigo,
      tipo_codigo_barras: tipo
    })
  }

  

  // Persistencia automática del borrador la maneja useStockForm (clave dinámica)

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
          }
        })
    }
  }, [modo, form.id, setForm])

  // Efecto para inicializar precios de listas cuando se carga el producto (modo edición)
  useEffect(() => {
    if (!stock) return
    
    // Inicializar precio Lista 0 desde el producto
    const precioLista0 = stock.precio_lista_0 || ''
    const esManualLista0 = stock.precio_lista_0_manual || false
    
    // Inicializar precios de listas 1-4 desde precios_listas
    const preciosListasIniciales = {
      lista0: { precio: precioLista0, manual: esManualLista0 },
      lista1: { precio: '', manual: false },
      lista2: { precio: '', manual: false },
      lista3: { precio: '', manual: false },
      lista4: { precio: '', manual: false },
    }
    
    // Cargar precios existentes de listas 1-4
    if (Array.isArray(stock.precios_listas)) {
      stock.precios_listas.forEach(pl => {
        const key = `lista${pl.lista_numero}`
        if (preciosListasIniciales[key]) {
          preciosListasIniciales[key] = {
            precio: pl.precio || '',
            manual: pl.precio_manual || false,
          }
        }
      })
    }
    
    setPreciosListas(preciosListasIniciales)
  }, [stock])

  // Obtener costo del proveedor habitual
  const obtenerCostoProveedorHabitual = () => {
    const provHabId = form.proveedor_habitual_id
    if (!provHabId) return 0
    
    // Buscar en stockProveParaMostrar o en stock.stock_proveedores
    const spEncontrado = stockProveParaMostrar.find(
      sp => String(sp.proveedor?.id || sp.proveedor) === String(provHabId)
    )
    return Number(spEncontrado?.costo || 0)
  }

  // Función para calcular precio Lista 0 desde costo + margen
  const calcularPrecioLista0Automatico = () => {
    const costo = obtenerCostoProveedorHabitual()
    const margen = Number(form.margen || 0)
    if (costo > 0 && margen >= 0) {
      return calcularPrecioLista0(costo, margen)
    }
    return 0
  }

  // Función para recalcular precios de listas 1-4 desde Lista 0
  const recalcularPreciosListas = (precioLista0) => {
    if (!precioLista0 || precioLista0 <= 0) return

    setPreciosListas(prev => {
      const nuevos = { ...prev }
      
      // Para cada lista 1-4, si no es manual, recalcular
      for (let i = 1; i <= 4; i++) {
        const key = `lista${i}`
        if (!nuevos[key].manual) {
          const listaConfig = listasPrecio.find(l => l.numero === i)
          const margenLista = Number(listaConfig?.margen_descuento || 0)
          nuevos[key] = {
            ...nuevos[key],
            precio: calcularPrecioLista(precioLista0, margenLista),
          }
        }
      }
      
      return nuevos
    })
  }

  // Handler para cuando cambia el precio de Lista 0
  const handlePrecioLista0Change = (valor, esManual = false) => {
    const precioNum = Number(valor) || 0
    
    setPreciosListas(prev => ({
      ...prev,
      lista0: { precio: precioNum || valor, manual: esManual },
    }))
    
    // Si se ingresa un precio manual, recalcular el margen
    if (esManual && precioNum > 0) {
      const costo = obtenerCostoProveedorHabitual()
      if (costo > 0) {
        const nuevoMargen = calcularMargenDesdePrecios(precioNum, costo)
        setForm(prev => ({ ...prev, margen: String(nuevoMargen) }))
      }
    }
    
    // Recalcular precios de listas 1-4
    if (precioNum > 0) {
      recalcularPreciosListas(precioNum)
    }
  }

  // Handler para cuando cambia el precio de una lista (1-4)
  const handlePrecioListaChange = (listaNumero, valor, esManual = false) => {
    const key = `lista${listaNumero}`
    const precioNum = Number(valor) || 0
    
    setPreciosListas(prev => ({
      ...prev,
      [key]: { precio: precioNum || valor, manual: esManual },
    }))
  }

  // Handler para toggle de precio manual
  const handleTogglePrecioManual = (listaNumero) => {
    const key = `lista${listaNumero}`
    
    setPreciosListas(prev => {
      const nuevoManual = !prev[key].manual
      
      // Si se desactiva el modo manual, recalcular el precio
      if (!nuevoManual) {
        if (listaNumero === 0) {
          // Recalcular Lista 0 desde costo + margen
          const precioCalculado = calcularPrecioLista0Automatico()
          return {
            ...prev,
            [key]: { precio: precioCalculado, manual: false },
          }
        } else {
          // Recalcular lista 1-4 desde Lista 0
          const precioLista0 = Number(prev.lista0.precio) || 0
          const listaConfig = listasPrecio.find(l => l.numero === listaNumero)
          const margenLista = Number(listaConfig?.margen_descuento || 0)
          const precioCalculado = calcularPrecioLista(precioLista0, margenLista)
          return {
            ...prev,
            [key]: { precio: precioCalculado, manual: false },
          }
        }
      }
      
      return {
        ...prev,
        [key]: { ...prev[key], manual: nuevoManual },
      }
    })
  }

  // Efecto para recalcular precios cuando cambia el margen (si Lista 0 no es manual)
  useEffect(() => {
    if (!preciosListas.lista0.manual && form.margen) {
      const precioCalculado = calcularPrecioLista0Automatico()
      if (precioCalculado > 0) {
        setPreciosListas(prev => ({
          ...prev,
          lista0: { ...prev.lista0, precio: precioCalculado },
        }))
        recalcularPreciosListas(precioCalculado)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.margen, form.proveedor_habitual_id])







  // Función de guardado usando el hook modular
  const handleSave = async (e) => {
    e.preventDefault()
    // Confirmación nativa antes de guardar
    const confirmar = window.confirm('¿Desea guardar los cambios del producto?')
    if (!confirmar) {
      return
    }
    
    // Validar el formulario antes de guardar
    if (!esValido) {
      // Primero manejar errores de campo específico (tooltips nativos)
      if (erroresCampo && erroresCampo.length > 0) {
        const primerErrorCampo = erroresCampo[0]
        // Buscar el campo en el formulario y mostrar tooltip nativo
        const campoElement = document.querySelector(`[name="${primerErrorCampo.campo}"]`)
        if (campoElement) {
          campoElement.setCustomValidity(primerErrorCampo.mensaje)
          campoElement.reportValidity()
          return
        }
      }
      
      // Si no hay errores de campo o no se pudo mostrar el tooltip, mostrar error general
      if (errores && errores.length > 0) {
        alert(errores[0]) // Notificación flotante con botón de aceptar
        return
      }
      
      // Fallback: mensaje genérico
      setFormError("Por favor corrija los errores en el formulario antes de guardar.")
      return
    }
    
    // Preparar formulario con precios de lista 0
    const formConPrecios = {
      ...form,
      precio_lista_0: Number(preciosListas.lista0.precio) || null,
      precio_lista_0_manual: preciosListas.lista0.manual,
    }
    
    // Usar el hook de guardado atómico (maneja todo internamente)
    const resultado = await guardarProductoAtomico(
      formConPrecios,
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
      const productoId = resultado.data?.id || form.id
      if (productoId) {
        try {
          const preciosAGuardar = [1, 2, 3, 4].map(i => ({
            lista_numero: i,
            precio: Number(preciosListas[`lista${i}`].precio) || 0,
            precio_manual: preciosListas[`lista${i}`].manual,
          }))
          
          await guardarPreciosProducto(productoId, preciosAGuardar)
        } catch (errorPrecios) {
          console.error('Error al guardar precios de listas:', errorPrecios)
        }
      }
      
      try { localStorage.removeItem(claveBorrador) } catch (_) {}
    }
  }









  // Logs ruidosos eliminados para mejorar rendimiento

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
          {...getFormProps()}
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

              {/* Los errores ahora se muestran como alertas nativas del navegador */}
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
                        value={form.codvta ?? ""}
                        onChange={handleChange}
                        maxLength={LONGITUD_MAX_CODIGO_VENTA}
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
                          value={form.deno ?? ""}
                          onChange={handleChange}
                          onBlur={modo === "nuevo" ? (e) => handleDenominacionBlur(e.target.value) : undefined}
                          maxLength={LONGITUD_MAX_DENOMINACION}
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
                        value={form.unidad ?? ""}
                        onChange={handleChange}
                        maxLength={LONGITUD_MAX_UNIDAD}
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
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs flex items-start gap-2">
                              <svg className="w-3 h-3 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="flex-1">{errorAsociar}</span>
                              <button
                                type="button"
                                onClick={() => setErrorAsociar(null)}
                                className="text-red-500 hover:text-red-700"
                                title="Cerrar"
                              >
                                ×
                              </button>
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
                                onChange={() => {
                                  setModoBusqueda("codigo")
                                  requestAnimationFrame(() => {
                                    if (referenciaCampoBusqueda.current) {
                                      referenciaCampoBusqueda.current.focus()
                                      referenciaCampoBusqueda.current.select()
                                    }
                                  })
                                }}
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
                                onChange={() => {
                                  setModoBusqueda("denominacion")
                                  requestAnimationFrame(() => {
                                    if (referenciaCampoBusqueda.current) {
                                      referenciaCampoBusqueda.current.focus()
                                      referenciaCampoBusqueda.current.select()
                                    }
                                  })
                                }}
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
                                ref={referenciaCampoBusqueda}
                                type="text"
                                value={codigoProveedor}
                                onChange={(e) => {
                                  setCodigoProveedor(e.target.value)
                                  setShowSugeridos(e.target.value.length > 0 && productosConDenominacion.length > 0)
                                }}
                                onFocus={() => setShowSugeridos(codigoProveedor.length > 0 && productosConDenominacion.length > 0)}
                                className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-8"
                                placeholder={modoBusqueda === "codigo" ? "Ingrese el código" : "Ingrese la denominación"}
                                maxLength={modoBusqueda === "codigo" ? LONGITUD_MAX_CODIGO_PROVEEDOR : undefined}
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
                  
                  {/* Código de Barras */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[12px] text-slate-700">Código de Barras</span>
                    <div className="min-w-[180px] text-right flex items-center gap-2 justify-end">
                      {codigoBarrasEfectivo ? (
                        <>
                          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {codigoBarrasEfectivo}
                          </span>
                          {/* Indicador si el código es local (no guardado aún) */}
                          {form.codigo_barras && form.codigo_barras !== stock?.codigo_barras && (
                            <span className="text-[10px] text-amber-600" title="Se guardará con el producto">
                              (pendiente)
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowCodigoBarrasModal(true)}
                            className="text-orange-600 hover:text-orange-800 text-xs"
                            title="Gestionar código de barras"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCodigoBarrasModal(true)}
                          className="w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-8 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 flex items-center justify-center gap-1"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 122.88 97.04" fill="currentColor">
                            <path d="M2.38,0h18.33v4.76H4.76V17.2H0V2.38C0,1.07,1.07,0,2.38,0L2.38,0z M17.92,16.23h8.26v64.58h-8.26V16.23L17.92,16.23z M69.41,16.23h5.9v64.58h-5.9V16.23L69.41,16.23z M57.98,16.23h4.42v64.58h-4.42V16.23L57.98,16.23z M33.19,16.23h2.51v64.58h-2.51 V16.23L33.19,16.23z M97.59,16.23h7.37v64.58h-7.37V16.23L97.59,16.23z M82.32,16.23h8.26v64.58h-8.26V16.23L82.32,16.23z M42.71,16.23h8.26v64.58h-8.26V16.23L42.71,16.23z M4.76,79.84v12.44h15.95v4.76H2.38C1.07,97.04,0,95.98,0,94.66V79.84H4.76 L4.76,79.84z M103.4,0h17.1c1.31,0,2.38,1.07,2.38,2.38V17.2h-4.76V4.76H103.4V0L103.4,0z M122.88,79.84v14.82 c0,1.31-1.07,2.38-2.38,2.38h-17.1v-4.76h14.72V79.84H122.88L122.88,79.84z"/>
                          </svg>
                          Agregar código
                        </button>
                      )}
                    </div>
                  </div>
                  
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
                        value={stockTotal ?? 0}
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
                        value={form.cantmin ?? ""}
                        onChange={handleChange}
                        min={CANTIDAD_MINIMA_MINIMO}
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
                        step={MARGEN_STEP}
                        min={MARGEN_MINIMO}
                        max={MARGEN_MAXIMO}
                        required
                        placeholder="% ganancia"
                      />
                    </div>
                  </div>

                  
                  {/* Stock Actual por Proveedor */}
                  {((stock && stock.id) || (!stock?.id && (stockProvePendientes.length > 0 || proveedoresAgregados.length > 0))) && (
                    <div className="pt-2 border-t border-slate-200">
                      <h6 className="text-[12px] font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <span>Stock por Proveedor</span>
                        <span
                          className="relative cursor-pointer"
                          onMouseEnter={() => setMostrarTooltipStock(true)}
                          onMouseLeave={() => setMostrarTooltipStock(false)}
                        >
                          <span className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors duration-200">
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
                          </span>
                          {mostrarTooltipStock && (
                            <span className="absolute left-6 top-0 z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl w-[450px]">
                              La edición de cantidad se realiza en "Compras", esta sección esta pensada para poder hacer correcciones.
                              <span className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></span>
                            </span>
                          )}
                        </span>
                      </h6>
                      <div className="space-y-1 text-xs leading-tight">
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
                                  <span className="text-xs font-semibold text-slate-700">
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
                                <div className="flex items-center justify-between text-xs text-slate-700 leading-tight">
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

              {/* Tarjeta Listas de Precios */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[260px]">
                <h5 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Listas de Precios
                </h5>
                <div className="divide-y divide-slate-200">
                  {/* Precio Lista 0 (Base) */}
                  <div className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[12px] text-slate-700 font-semibold">Lista 0 (Base)</span>
                        <span
                          className="relative cursor-pointer"
                          onMouseEnter={() => setMostrarTooltipPrecioManual(0)}
                          onMouseLeave={() => setMostrarTooltipPrecioManual(null)}
                        >
                          <span className="w-3 h-3 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
                            <svg className="w-2 h-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          {mostrarTooltipPrecioManual === 0 && (
                            <span className="absolute left-4 top-0 z-20 bg-slate-800 text-white text-xs rounded px-2 py-1 shadow-lg w-48">
                              Precio base calculado desde costo + margen. Puede editarse manualmente.
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={preciosListas.lista0.manual}
                            onChange={() => handleTogglePrecioManual(0)}
                            className="w-3 h-3 accent-orange-600"
                          />
                          Manual
                        </label>
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={preciosListas.lista0.precio}
                          onChange={(e) => handlePrecioLista0Change(e.target.value, preciosListas.lista0.manual)}
                          disabled={!preciosListas.lista0.manual}
                          className={`w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-7 ${
                            preciosListas.lista0.manual
                              ? 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Separador visual */}
                  <div className="py-1 bg-slate-100 -mx-2 px-2">
                    <span className="text-[10px] text-slate-500 font-medium">Listas derivadas (desde Lista 0)</span>
                  </div>

                  {/* Precios Listas 1-4 */}
                  {[1, 2, 3, 4].map((listaNum) => {
                    const key = `lista${listaNum}`
                    const listaConfig = listasPrecio.find(l => l.numero === listaNum)
                    const nombreLista = listaConfig?.nombre || `Lista ${listaNum}`
                    const margenLista = listaConfig?.margen_descuento || 0
                    
                    return (
                      <div key={listaNum} className="py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-[12px] text-slate-700">{nombreLista}</span>
                            <span className="text-[10px] text-slate-400">
                              ({margenLista >= 0 ? '+' : ''}{margenLista}%)
                            </span>
                            {preciosListas[key].manual && (
                              <span
                                className="relative cursor-pointer"
                                onMouseEnter={() => setMostrarTooltipPrecioManual(listaNum)}
                                onMouseLeave={() => setMostrarTooltipPrecioManual(null)}
                              >
                                <span className="w-3 h-3 rounded-full bg-amber-200 flex items-center justify-center">
                                  <svg className="w-2 h-2 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </span>
                                {mostrarTooltipPrecioManual === listaNum && (
                                  <span className="absolute left-4 top-0 z-20 bg-amber-800 text-white text-xs rounded px-2 py-1 shadow-lg w-52">
                                    Precio cargado manualmente. No se actualizará al cambiar el margen general de esta lista.
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <label className="flex items-center gap-1 text-[10px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={preciosListas[key].manual}
                              onChange={() => handleTogglePrecioManual(listaNum)}
                              className="w-3 h-3 accent-orange-600"
                            />
                            Manual
                          </label>
                        </div>
                        <div className="mt-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={preciosListas[key].precio}
                              onChange={(e) => handlePrecioListaChange(listaNum, e.target.value, preciosListas[key].manual)}
                              disabled={!preciosListas[key].manual}
                              className={`w-full border border-slate-300 rounded-sm px-2 py-1 text-xs h-7 ${
                                preciosListas[key].manual
                                  ? 'bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                onClick={() => {
                  const confirmar = window.confirm('¿Desea cancelar y descartar los cambios?')
                  if (!confirmar) return
                  handleCancel()
                }}
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

      {/* Modal de Código de Barras */}
      <CodigoBarrasModal
        open={showCodigoBarrasModal}
        onClose={() => setShowCodigoBarrasModal(false)}
        producto={stock || { id: null, codvta: form.codvta, deno: form.deno }}
        codigoBarrasInicial={codigoBarrasEfectivo}
        tipoCodigoBarrasInicial={tipoCodigoBarrasEfectivo}
        onCodigoChange={handleCodigoBarrasChange}
        onActualizado={() => {
          // Refrescar datos del producto si es necesario (solo para productos existentes)
        }}
      />

    </div>
  )
}

export default StockForm;
