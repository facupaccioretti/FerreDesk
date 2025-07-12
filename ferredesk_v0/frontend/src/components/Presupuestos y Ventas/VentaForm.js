"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import ComprobanteDropdown from "../ComprobanteDropdown"
import { manejarCambioFormulario, manejarCambioCliente, manejarSeleccionClienteObjeto } from "./herramientasforms/manejoFormulario"
import { mapearCamposItem } from "./herramientasforms/mapeoItems"
import { useClientesConDefecto } from "./herramientasforms/useClientesConDefecto"
import { useCalculosFormulario } from "./herramientasforms/useCalculosFormulario"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { useFormularioDraft } from "./herramientasforms/useFormularioDraft"
import { useComprobanteFiscal } from "./herramientasforms/useComprobanteFiscal"
import ClienteSelectorModal from "../Clientes/ClienteSelectorModal"

const getInitialFormState = (sucursales = [], puntosVenta = []) => ({
  numero: "",
  cliente: "",
  clienteId: "",
  cuit: "",
  domicilio: "",
  plazoId: "",
  vendedorId: "",
  sucursalId: sucursales[0]?.id || "",
  puntoVentaId: puntosVenta[0]?.id || "",
  fecha: new Date().toISOString().split("T")[0],
  estado: "Abierto",
  tipo: "Factura Interna",
  items: [],
  bonificacionGeneral: 0,
  total: 0,
  descu1: 0,
  descu2: 0,
  descu3: 0,
  copia: 1,
})

const mergeWithDefaults = (data, sucursales = [], puntosVenta = []) => ({
  ...getInitialFormState(sucursales, puntosVenta),
  ...data,
  items: Array.isArray(data?.items) ? data.items : [],
})

const getStockProveedoresMap = (productos) => {
  const map = {}
  productos.forEach((p) => {
    if (p.stock_proveedores) {
      map[p.id] = p.stock_proveedores
    }
  })
  return map
}

const VentaForm = ({
  onSave,
  onCancel,
  initialData,
  readOnlyOverride,
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
  tabKey = `venta-${Date.now()}` // Valor por defecto en caso de que no se pase
}) => {
  // Estados para manejar la carga
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)

  // Hooks existentes movidos al inicio
  const { clientes: clientesConDefecto, loading: loadingClientes, error: errorClientes } = useClientesConDefecto()
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotasIVA, error: errorAlicuotasIVA } = useAlicuotasIVAAPI()

  // Estados sincronizados para comprobante y tipo
  const [inicializado, setInicializado] = useState(false)
  const [tipoComprobante, setTipoComprobante] = useState("")
  const [comprobanteId, setComprobanteId] = useState("")

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
    claveAlmacenamiento: `ventaFormDraft_${tabKey}`,
    datosIniciales: initialData,
    combinarConValoresPorDefecto: mergeWithDefaults,
    parametrosPorDefecto: [sucursales, puntosVenta],
    normalizarItems,
  })

  const alicuotasMap = useMemo(
    () =>
      Array.isArray(alicuotasIVA)
        ? alicuotasIVA.reduce((acc, ali) => {
            acc[ali.id] = Number.parseFloat(ali.porce) || 0
            return acc
          }, {})
        : {},
    [alicuotasIVA],
  )

  const { totales } = useCalculosFormulario(formulario.items, {
    bonificacionGeneral: formulario.bonificacionGeneral,
    descu1: formulario.descu1,
    descu2: formulario.descu2,
    descu3: formulario.descu3,
    alicuotas: alicuotasMap,
  })

  const itemsGridRef = useRef()
  const stockProveedores = useMemo(() => getStockProveedoresMap(productos), [productos])

  // ------------------------------------------------------------
  // LOG DE DIAGNÓSTICO: ¿Cuándo se arma stockProveedores y qué trae?
  // ------------------------------------------------------------
  useEffect(() => {
    console.debug("[VentaForm] stockProveedores listo", {
      loadingProductos,
      loadingProveedores,
      keys: Object.keys(stockProveedores || {}).length,
    })
  }, [loadingProductos, loadingProveedores, stockProveedores])

  // Nuevo: obtener comprobantes de tipo Venta (o los que no sean Presupuesto)
  const comprobantesVenta = comprobantes.filter((c) => (c.tipo || "").toLowerCase() !== "presupuesto")

  // Efecto de inicialización sincronizada
  useEffect(() => {
    if (!inicializado && comprobantesVenta.length > 0) {
      const comprobanteFacturaInterna = comprobantesVenta.find((c) => (c.tipo || "").toLowerCase() === "factura_interna")
      if (comprobanteFacturaInterna) {
        setTipoComprobante("factura_interna")
        setComprobanteId(comprobanteFacturaInterna.id)
      } else {
        setTipoComprobante(comprobantesVenta[0].tipo?.toLowerCase() || "factura_interna")
        setComprobanteId(comprobantesVenta[0].id)
      }
      setInicializado(true)
    }
  }, [inicializado, comprobantesVenta])

  useEffect(() => {
    if (comprobantesVenta.length > 0 && !comprobanteId) {
      setComprobanteId(comprobantesVenta[0].id)
    }
  }, [comprobantesVenta, comprobanteId])

  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados("sumar")
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados])

  // Efecto para seleccionar automáticamente Cliente Mostrador (ID 1)
  useEffect(() => {
    if (!formulario.clienteId && clientesConDefecto.length > 0) {
      const mostrador = clientesConDefecto.find((c) => String(c.id) === "1")
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
  }, [clientesConDefecto, formulario.clienteId, setFormulario])

  // Sincronizar comprobanteId con el tipo de comprobante seleccionado
  useEffect(() => {
    const comprobanteDelTipo = comprobantesVenta.find((c) => (c.tipo || "").toLowerCase() === tipoComprobante)
    if (comprobanteDelTipo && comprobanteId !== comprobanteDelTipo.id) {
      setComprobanteId(comprobanteDelTipo.id)
    }
  }, [tipoComprobante, comprobantesVenta, comprobanteId])

  // Efecto para manejar el estado de carga
  useEffect(() => {
    if (!inicializado) {
      setIsLoading(true)
      return
    }
    if (loadingClientes || loadingAlicuotasIVA) {
      setIsLoading(true)
      return
    }
    if (errorClientes || errorAlicuotasIVA) {
      setLoadingError(errorClientes || errorAlicuotasIVA)
      setIsLoading(false)
      return
    }
    setIsLoading(false)
  }, [inicializado, loadingClientes, loadingAlicuotasIVA, errorClientes, errorAlicuotasIVA])

  // Determinar cliente seleccionado (siempre debe haber uno, por defecto el mostrador)
  const clienteSeleccionado =
    clientes.find((c) => String(c.id) === String(formulario.clienteId)) ||
    clientesConDefecto.find((c) => String(c.id) === String(formulario.clienteId)) ||
    clientesConDefecto.find((c) => String(c.id) === "1") // Mostrador por defecto

  // Construir objeto para validación fiscal con datos actuales del formulario
  const clienteParaFiscal = useMemo(() => {
    if (!clienteSeleccionado) return null
    return {
      ...clienteSeleccionado,
      cuit: formulario.cuit,
      domicilio: formulario.domicilio,
      razon: formulario.razon || clienteSeleccionado.razon,
      nombre: formulario.nombre || clienteSeleccionado.nombre,
    }
  }, [clienteSeleccionado, formulario.cuit, formulario.domicilio, formulario.razon, formulario.nombre])

  const usarFiscal = tipoComprobante === "factura"
  const fiscal = useComprobanteFiscal({
    tipoComprobante: usarFiscal ? "factura" : "",
    cliente: usarFiscal ? clienteParaFiscal : null,
  })
  const comprobanteLetra = usarFiscal ? fiscal.letra : "V"
  const comprobanteRequisitos = usarFiscal ? fiscal.requisitos : null
  const loadingComprobanteFiscal = usarFiscal ? fiscal.loading : false
  const errorComprobanteFiscal = usarFiscal ? fiscal.error : null

  // Determinar el código AFIP y la letra a mostrar en el badge
  let letraComprobanteMostrar = "V"
  let codigoAfipMostrar = ""
  if (usarFiscal && fiscal.comprobanteFiscal && fiscal.comprobanteFiscal.codigo_afip) {
    letraComprobanteMostrar = fiscal.letra || "A"
    codigoAfipMostrar = fiscal.comprobanteFiscal.codigo_afip
  } else if (comprobantesVenta.length > 0 && comprobanteId) {
    const compSeleccionado = comprobantesVenta.find((c) => c.id === comprobanteId)
    if (compSeleccionado) {
      letraComprobanteMostrar = compSeleccionado.letra || "V"
      codigoAfipMostrar = compSeleccionado.codigo_afip || ""
    }
  }

  // Nuevo: calcular número de comprobante según comprobante seleccionado
  const numeroComprobante = (() => {
    const comp = comprobantesVenta.find((c) => c.id === comprobanteId)
    if (!comp) return 1
    return (comp.ultimo_numero || 0) + 1
  })()

  const handleChange = manejarCambioFormulario(setFormulario)
  const handleClienteChange = manejarCambioCliente(setFormulario, clientes)
  const handleClienteSelect = manejarSeleccionClienteObjeto(setFormulario)

  // Estado para modal selector de clientes
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  const abrirSelector = () => setSelectorAbierto(true)
  const cerrarSelector = () => setSelectorAbierto(false)
  const onSeleccionarDesdeModal = (cli) => {
    handleClienteSelect(cli)
  }

  // Bloquear envío de formulario al presionar Enter en cualquier campo
  const bloquearEnterSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
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
      limpiarBorrador()

      // Determinar el tipo de comprobante como string fijo
      // Si el comprobante seleccionado tiene tipo "factura", usar "factura", si no, usar "factura_interna"
      const tipoComprobanteSeleccionado =
        comprobantesVenta.find((c) => c.id === comprobanteId) &&
        (comprobantesVenta.find((c) => c.id === comprobanteId).tipo || "").toLowerCase() === "factura"
          ? "factura"
          : "factura_interna"
      
      // HÍBRIDO: Enviar solo el TIPO al backend, no código AFIP específico
      // El backend ejecutará su propia lógica fiscal autoritaria

      // Definir constantes descriptivas para valores por defecto
      // Estado cerrado para ventas
      const ESTADO_VENTA_CERRADA = "CE"
      // Tipo de operación para ventas
      const TIPO_VENTA = "Venta"

      // Construir el payload asegurando conversiones de tipo y sin valores mágicos
      const payload = {
        ven_estado: ESTADO_VENTA_CERRADA, // Estado cerrado
        ven_tipo: TIPO_VENTA, // Tipo de operación
        tipo_comprobante: tipoComprobanteSeleccionado, // "factura" o "factura_interna"
        // NO enviar comprobante_id - el backend determinará el código AFIP usando lógica fiscal
        ven_numero: Number.parseInt(formulario.numero, 10) || numeroComprobante, // Número de comprobante
        ven_sucursal: Number.parseInt(formulario.sucursalId, 10) || 1, // Sucursal
        ven_fecha: formulario.fecha, // Fecha
        ven_punto: Number.parseInt(formulario.puntoVentaId, 10) || 1, // Punto de venta
        ven_impneto: Number.parseFloat(formulario.ven_impneto) || 0, // Importe neto
        ven_descu1: Number.parseFloat(formulario.descu1) || 0, // Descuento 1
        ven_descu2: Number.parseFloat(formulario.descu2) || 0, // Descuento 2
        ven_descu3: Number.parseFloat(formulario.descu3) || 0, // Descuento 3
        bonificacionGeneral: Number.parseFloat(formulario.bonificacionGeneral) || 0, // Bonificación general
        ven_bonificacion_general: Number.parseFloat(formulario.bonificacionGeneral) || 0, // Bonificación general (duplicado por compatibilidad)
        ven_total: Number.parseFloat(formulario.ven_total) || 0, // Total
        ven_vdocomvta: Number.parseFloat(formulario.ven_vdocomvta) || 0, // Valor documento venta
        ven_vdocomcob: Number.parseFloat(formulario.ven_vdocomcob) || 0, // Valor documento cobro
        ven_idcli: formulario.clienteId, // ID cliente
        ven_idpla: formulario.plazoId, // ID plazo
        ven_idvdo: formulario.vendedorId, // ID vendedor
        ven_copia: Number.parseInt(formulario.copia, 10) || 1, // Cantidad de copias
        items: items.map((item, idx) => mapearCamposItem(item, idx)), // Ítems mapeados
        permitir_stock_negativo: true, // Permitir stock negativo
      }

      // Agregar CUIT y domicilio si existen
      if (formulario.cuit) payload.ven_cuit = formulario.cuit
      if (formulario.domicilio) payload.ven_domicilio = formulario.domicilio

      await onSave(payload)
      onCancel()
    } catch (error) {
      console.error("Error al guardar venta:", error)
    }
  }

  const handleCancel = () => {
    limpiarBorrador()
    onCancel()
  }

  // Función para agregar producto a la grilla desde el buscador
  const handleAddItemToGrid = (producto) => {
    if (itemsGridRef.current) {
      itemsGridRef.current.handleAddItem(producto)
    }
  }

  const isReadOnly = readOnlyOverride || formulario.estado === "Cerrado"

  // Función para actualizar los ítems en tiempo real desde ItemsGrid
  const handleRowsChange = (rows) => {
    actualizarItems(rows)
  }

  // Opciones fijas para el dropdown
  const opcionesComprobante = [
    { value: "factura_interna", label: "Factura Interna", tipo: "factura_interna", letra: "I" },
    { value: "factura", label: "Factura", tipo: "factura" },
  ]

  // Renderizado condicional al final
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/30 py-6">
      <div className="px-6">
        <form
          className="venta-form w-full bg-white rounded-2xl shadow-2xl border border-slate-200/50 relative overflow-hidden"
          onSubmit={handleSubmit}
          onKeyDown={bloquearEnterSubmit}
        >
          {/* Gradiente decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600"></div>

          <div className="px-8 pt-4 pb-6">
            {/* Badge de letra de comprobante */}
            {letraComprobanteMostrar && (
              <div className="absolute top-6 right-6 z-10">
                <div className="w-14 h-14 flex flex-col items-center justify-center border-2 border-slate-800 shadow-xl bg-gradient-to-br from-white to-slate-50 rounded-xl ring-1 ring-slate-200/50">
                  <span className="text-2xl font-extrabold font-serif text-slate-900 leading-none">
                    {letraComprobanteMostrar}
                  </span>
                  <span className="text-[9px] font-mono text-slate-600 mt-0.5 font-medium">
                    COD {codigoAfipMostrar}
                  </span>
                </div>
              </div>
            )}

            {/* Mensaje de requisitos solo si es factura */}
            {usarFiscal && comprobanteRequisitos && comprobanteRequisitos.mensaje && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 mt-4 text-sm text-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 rounded-xl shadow-lg border border-blue-200/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {comprobanteRequisitos.mensaje}
                </div>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                {initialData ? (isReadOnly ? "Ver Factura" : "Editar Factura") : "Nueva Factura"}
              </h3>

              {isReadOnly && (
                <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-amber-100/80 border-l-4 border-amber-500 text-amber-900 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="font-medium">
                      Este comprobante está cerrado y no puede ser editado. Solo lectura.
                    </span>
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
                        value={clienteSeleccionado ? (clienteSeleccionado.razon || clienteSeleccionado.nombre) : ""}
                        readOnly
                        disabled
                        className="compacto max-w-xs w-full px-3 py-2 border border-slate-300 rounded-lg text-base bg-slate-100 text-slate-600 cursor-not-allowed"
                      />
                      {/* Botón para abrir modal selector */}
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={abrirSelector}
                          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors"
                          title="Buscar en lista completa"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4 text-slate-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 9.75a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M18.75 18.75l-3.5-3.5"
                            />
                          </svg>
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
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Punto Venta */}
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
                    {puntosVenta.map((pv) => (
                      <option key={pv.id} value={pv.id}>{pv.nombre}</option>
                    ))}
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
                    {plazos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
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
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ÍTEMS: Título, luego buscador y descuentos alineados horizontalmente */}
            <div className="mb-6">
              {/* Encabezado eliminado para maximizar espacio */}

              <div className="flex flex-row items-center gap-4 w-full mb-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/50 flex-wrap">
                {/* Buscador de producto */}
                <div className="min-w-[260px] w-[260px]">
                  <BuscadorProducto productos={productos} onSelect={handleAddItemToGrid} />
                </div>

                {/* Tipo de Comprobante */}
                <div className="w-40">
                  <label className="block text-base font-semibold text-slate-700 mb-2">Tipo de Comprobante *</label>
                  <ComprobanteDropdown
                    opciones={opcionesComprobante}
                    value={tipoComprobante}
                    onChange={setTipoComprobante}
                    disabled={isReadOnly}
                    className="w-full max-w-[120px]"
                  />
                </div>

                {/* Acción por defecto duplicado */}
                <div className="w-56">
                  <SumarDuplicar
                    autoSumarDuplicados={autoSumarDuplicados}
                    setAutoSumarDuplicados={setAutoSumarDuplicados}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              {loadingProductos || loadingFamilias || loadingProveedores || loadingAlicuotas ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Cargando productos, familias, proveedores y alícuotas...</p>
                </div>
              ) : errorProductos ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-red-600 font-medium mb-2">Error al cargar productos</div>
                    <p className="text-red-700 text-sm">{errorProductos}</p>
                  </div>
                </div>
              ) : errorFamilias ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-red-600 font-medium mb-2">Error al cargar familias</div>
                    <p className="text-red-700 text-sm">{errorFamilias}</p>
                  </div>
                </div>
              ) : errorProveedores ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-red-600 font-medium mb-2">Error al cargar proveedores</div>
                    <p className="text-red-700 text-sm">{errorProveedores}</p>
                  </div>
                </div>
              ) : errorAlicuotas ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                    <div className="text-red-600 font-medium mb-2">Error al cargar alícuotas</div>
                    <p className="text-red-700 text-sm">{errorAlicuotas}</p>
                  </div>
                </div>
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
                  modo="venta"
                  alicuotas={alicuotasMap}
                  onRowsChange={handleRowsChange}
                  initialItems={formulario.items}
                />
              )}
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
                  {initialData ? "Guardar Cambios" : "Crear Venta"}
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
        onSeleccionar={onSeleccionarDesdeModal}
        cargando={loadingClientes}
        error={errorClientes}
      />
    </div>
  )
}

export default VentaForm;
