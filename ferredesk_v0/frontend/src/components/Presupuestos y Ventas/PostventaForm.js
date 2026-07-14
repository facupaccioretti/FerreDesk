import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ItemsGrid from "./ItemsGrid"
import BuscadorProducto from "../BuscadorProducto"
import { useVentaDetalleAPI } from "../../utils/useVentaDetalleAPI"
import { useAlicuotasIVAAPI } from "../../utils/useAlicuotasIVAAPI"
import { useCalculosFormulario } from "./herramientasforms/useCalculosFormulario"
import SumarDuplicar from "./herramientasforms/SumarDuplicar"
import { mapearCamposItem } from "./herramientasforms/mapeoItems"
import { normalizarItems } from "./herramientasforms/normalizadorItems"
import usePostventaAPI from "./hooks/usePostventaAPI"
import { useCajaAPI } from "../../utils/useCajaAPI"

const INPUT_CLASS = "w-full border border-slate-300 rounded-none px-2 py-1 text-xs h-8 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
const PANEL_CLASS = "p-2 bg-slate-50 rounded-sm border border-slate-200"
const SECTION_TITLE_CLASS = "block text-[12px] font-semibold text-slate-700 mb-1"
const MONEY_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const clampCantidad = (value, max) => {
  const numero = Number.parseFloat(value)

  if (!Number.isFinite(numero) || numero < 0) return 0
  if (!Number.isFinite(max) || max <= 0) return numero

  return Math.min(numero, max)
}

export const crearItemsOrigen = (items = []) =>
  items.map((item, index) => {
    const cantidadOriginal = Number.parseFloat(item.cantidad ?? item.vdi_cantidad ?? 0) || 0
    const precioUnitario = Number.parseFloat(item.precioFinal ?? item.vdi_precio_unitario_final ?? 0) || 0

    return {
      key: item.id ?? item.vdi_id ?? item.vdi_orden ?? index + 1,
      origenItemId: item.id ?? item.vdi_id ?? item.vdi_orden ?? index + 1,
      vdi_id: item.vdi_id ?? item.id ?? null,
      vdi_orden: item.vdi_orden ?? index + 1,
      vdi_idsto: item.vdi_idsto ?? item.producto?.id ?? null,
      codigo: item.codigo ?? item.producto?.codvta ?? item.producto?.codigo ?? "",
      detalle: item.vdi_detalle1 ?? item.denominacion ?? item.producto?.deno ?? "",
      unidad: item.vdi_detalle2 ?? item.unidad ?? item.producto?.unidadmedida ?? "-",
      cantidadOriginal,
      cantidad: 0,
      precioUnitario,
      subtotal: cantidadOriginal * precioUnitario,
    }
  })

const obtenerNumeroComprobante = (comprobante, ventaCalculada) =>
  ventaCalculada?.numero_formateado ||
  comprobante?.numero_formateado ||
  comprobante?.numero ||
  comprobante?.id

const formatMoney = (value) => `$${MONEY_FORMATTER.format(Number(value || 0))}`

const normalizarColeccion = (value) => (
  Array.isArray(value) ? value : value?.results || []
)

const CODIGOS_MEDIOS_POSTVENTA = {
  entrada: ["efectivo", "transferencia", "qr", "tarjeta_debito", "tarjeta_credito"],
  salida: ["efectivo", "transferencia"],
}

const normalizarMedioPago = (medio) => ({
  metodo_pago_id: Number(medio.metodo_pago_id),
  monto: Number(medio.monto).toFixed(2),
  ...(medio.cuenta_banco_id ? { cuenta_banco_id: Number(medio.cuenta_banco_id) } : {}),
  ...(medio.referencia_externa ? { referencia_externa: medio.referencia_externa.trim() } : {}),
  ...(medio.observacion ? { observacion: medio.observacion.trim() } : {}),
})

const calcularTotalMedios = (medios = []) => (
  medios.reduce((total, medio) => total + Number(medio.monto || 0), 0)
)

const calcularMontoEfectivo = (medios = [], metodos = []) => (
  medios.reduce((total, medio) => {
    const metodo = metodos.find((item) => String(item.id) === String(medio.metodo_pago_id))
    return String(metodo?.codigo || "").toLowerCase() === "efectivo"
      ? total + Number(medio.monto || 0)
      : total
  }, 0)
)

const direccionMediosPostventa = (resolucion) => {
  if (resolucion === "COBRAR_DIFERENCIA") return "entrada"
  if (resolucion === "DEVOLVER_DINERO") return "salida"
  return null
}

export const filtrarMetodosPostventa = (metodos, direccion, tieneCajaAbierta, tieneCuentasBanco) => {
  const permitidos = CODIGOS_MEDIOS_POSTVENTA[direccion] || []
  return metodos.filter((metodo) => {
    const codigo = String(metodo.codigo || "").toLowerCase()
    if (!permitidos.includes(codigo)) return false
    if (metodo.afecta_arqueo && !tieneCajaAbierta) return false
    if (esMedioBancario(metodo) && !tieneCuentasBanco) return false
    return true
  })
}

const obtenerMontoObjetivo = (modo, resumen, resolucion) => {
  if (resolucion === "COBRAR_DIFERENCIA") return Number(resumen?.diferencia || 0)
  if (resolucion !== "DEVOLVER_DINERO") return 0
  return modo === "devolucion"
    ? Number(resumen?.maximo_saldo_a_favor_o_devolucion || 0)
    : Number(resumen?.diferencia || 0)
}

const esMedioBancario = (metodo) => [
  "transferencia",
  "qr",
  "tarjeta_debito",
  "tarjeta_credito",
].includes(String(metodo?.codigo || "").toLowerCase())

const resolucionDiferenciaPorDefecto = (previewData) => {
  const direccion = previewData?.resumen_monetario?.direccion_diferencia
  if (direccion === "CLIENTE_PAGA") return "COBRAR_DIFERENCIA"
  if (direccion === "CLIENTE_RECIBE") return "SALDO_A_FAVOR"
  return "SIN_DIFERENCIA"
}

export const buildItemsNuevosPayload = (rows = []) => (
  rows
    .map((item, index) => {
      const mapped = mapearCamposItem(item, index)
      const stockId = mapped.vdi_idsto ?? mapped.id ?? item.vdi_idsto ?? item.id ?? null
      const cantidad = mapped.vdi_cantidad ?? item.vdi_cantidad ?? item.cantidad ?? 0

      if (!stockId || Number(cantidad) <= 0) return null

      return {
        stock_id: stockId,
        cantidad: Number(cantidad).toFixed(2),
        precio_unitario: Number(mapped.vdi_precio_unitario_final).toFixed(2),
      }
    })
    .filter(Boolean)
)

export const buildConfirmPayload = ({
  modo,
  observacion,
  previewPayload,
  previewData,
  resolucionDinero = "SALDO_A_FAVOR",
  resolucionDiferencia,
  mediosPago = [],
}) => {
  const motivo = observacion.trim()

  if (modo === "cambio") {
    const direccion = previewData?.resumen_monetario?.direccion_diferencia
    const resolucionFinal = direccion === "SIN_DIFERENCIA"
      ? "SIN_DIFERENCIA"
      : resolucionDiferencia || resolucionDiferenciaPorDefecto(previewData)

    return {
      ...previewPayload,
      motivo,
      motivo_forzado: "",
      resolucion_diferencia: resolucionFinal,
      ...(direccionMediosPostventa(resolucionFinal)
        ? { medios_diferencia: mediosPago.map(normalizarMedioPago) }
        : {}),
    }
  }

  return {
    ...previewPayload,
    motivo,
    motivo_forzado: "",
    resolucion_dinero: resolucionDinero,
    ...(direccionMediosPostventa(resolucionDinero)
      ? { medios: mediosPago.map(normalizarMedioPago) }
      : {}),
  }
}

const renderLineaProducto = (item, key, cantidadKey, subtotalKey) => (
  <div key={key} className="flex items-start justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
    <div className="min-w-0">
      <div className="text-xs font-semibold text-slate-800">{item.detalle || "Producto sin descripcion"}</div>
      <div className="text-[11px] text-slate-500">
        Cantidad: {item[cantidadKey]}{item.precio_unitario_origen ? ` · Unitario ${formatMoney(item.precio_unitario_origen)}` : ""}
        {item.precio_unitario_actual ? ` · Unitario ${formatMoney(item.precio_unitario_actual)}` : ""}
      </div>
    </div>
    <div className="shrink-0 text-xs font-semibold text-slate-700">
      {subtotalKey ? formatMoney(item[subtotalKey]) : ""}
    </div>
  </div>
)

const renderLineaProductoVista = (item, key, cantidadKey, subtotalKey) => (
  <div key={key} className="flex items-start justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
    <div className="min-w-0">
      <div className="text-xs font-semibold text-slate-800">{item.detalle || "Producto sin descripcion"}</div>
      <div className="text-[11px] text-slate-500">
        Cantidad: {item[cantidadKey]}{item.precio_unitario_origen ? ` - Unitario ${formatMoney(item.precio_unitario_origen)}` : ""}
        {item.precio_unitario_actual ? ` - Unitario ${formatMoney(item.precio_unitario_actual)}` : ""}
      </div>
    </div>
    <div className="shrink-0 text-xs font-semibold text-slate-700">
      {subtotalKey ? formatMoney(item[subtotalKey]) : ""}
    </div>
  </div>
)

const PostventaForm = ({
  comprobante,
  onCancel,
  onSuccess,
  autoSumarDuplicados,
  setAutoSumarDuplicados,
}) => {
  const comprobanteId = comprobante?.id ?? comprobante?.ven_id ?? null
  const itemsGridRef = useRef(null)

  const [modo, setModo] = useState("devolucion")
  const [observacion, setObservacion] = useState("")
  const [itemsOrigen, setItemsOrigen] = useState([])
  const [itemsNuevos, setItemsNuevos] = useState([])
  const [bonificacionGeneral, setBonificacionGeneral] = useState(0)
  const [descu1, setDescu1] = useState(0)
  const [descu2, setDescu2] = useState(0)
  const [descu3, setDescu3] = useState(0)
  const [ultimoPreviewContext, setUltimoPreviewContext] = useState(null)
  const [resolucionDinero, setResolucionDinero] = useState("SALDO_A_FAVOR")
  const [resolucionDiferencia, setResolucionDiferencia] = useState("SALDO_A_FAVOR")
  const [metodosPago, setMetodosPago] = useState([])
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [mediosPago, setMediosPago] = useState([])

  const { ventaCalculada, itemsCalculados, cargando, error: detalleError } = useVentaDetalleAPI(comprobanteId)
  const { alicuotas: alicuotasIVA, loading: loadingAlicuotas } = useAlicuotasIVAAPI()
  const { obtenerMetodosPago, obtenerCuentasBanco, obtenerMiCaja } = useCajaAPI()
  const {
    preview,
    error: postventaError,
    previewLoading,
    confirmLoading,
    previsualizarDevolucion,
    confirmarDevolucion,
    previsualizarCambio,
    confirmarCambio,
    resetPreview,
    renewIdempotencyKey,
  } = usePostventaAPI(comprobanteId)

  useEffect(() => {
    setModo("devolucion")
    setObservacion("")
    setItemsOrigen([])
    setItemsNuevos([])
    setBonificacionGeneral(0)
    setDescu1(0)
    setDescu2(0)
    setDescu3(0)
    setUltimoPreviewContext(null)
    setResolucionDinero("SALDO_A_FAVOR")
    setResolucionDiferencia("SALDO_A_FAVOR")
    setMediosPago([])
  }, [comprobanteId])

  useEffect(() => {
    let activo = true
    Promise.all([obtenerMetodosPago(true), obtenerCuentasBanco(true), obtenerMiCaja()])
      .then(([metodos, cuentas, caja]) => {
        if (!activo) return
        setMetodosPago(normalizarColeccion(metodos))
        setCuentasBanco(normalizarColeccion(cuentas))
        setCajaAbierta(Boolean(caja?.tiene_caja_abierta))
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [obtenerCuentasBanco, obtenerMetodosPago, obtenerMiCaja])

  useEffect(() => {
    if (!Array.isArray(itemsCalculados)) return
    setItemsOrigen(crearItemsOrigen(itemsCalculados))
  }, [itemsCalculados])

  useEffect(() => {
    if (!autoSumarDuplicados) {
      setAutoSumarDuplicados("sumar")
    }
  }, [autoSumarDuplicados, setAutoSumarDuplicados])

  const alicuotasMap = useMemo(() => (
    Array.isArray(alicuotasIVA)
      ? alicuotasIVA.reduce((acc, ali) => {
        acc[ali.id] = Number.parseFloat(ali.porce) || 0
        return acc
      }, {})
      : {}
  ), [alicuotasIVA])

  const { totales } = useCalculosFormulario(itemsNuevos, {
    bonificacionGeneral,
    descu1,
    descu2,
    descu3,
    alicuotas: alicuotasMap,
  })

  const limpiarPreview = useCallback(() => {
    resetPreview()
    setUltimoPreviewContext(null)
    setResolucionDinero("SALDO_A_FAVOR")
    setResolucionDiferencia("SALDO_A_FAVOR")
    setMediosPago([])
  }, [resetPreview])

  const handleModoChange = useCallback((nuevoModo) => {
    setModo(nuevoModo)
    limpiarPreview()
  }, [limpiarPreview])

  const handleObservacionChange = useCallback((event) => {
    setObservacion(event.target.value)
  }, [])

  const handleCantidadOrigenChange = useCallback((index, value) => {
    setItemsOrigen((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, cantidad: clampCantidad(value, item.cantidadOriginal) }
        : item
    )))
    limpiarPreview()
  }, [limpiarPreview])

  const handleSeleccionarTodo = useCallback((index) => {
    setItemsOrigen((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, cantidad: item.cantidadOriginal }
        : item
    )))
    limpiarPreview()
  }, [limpiarPreview])

  const handleLimpiarFila = useCallback((index) => {
    setItemsOrigen((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, cantidad: 0 }
        : item
    )))
    limpiarPreview()
  }, [limpiarPreview])

  const handleAddItemToGrid = useCallback((producto) => {
    itemsGridRef.current?.handleAddItem(producto)
    limpiarPreview()
  }, [limpiarPreview])

  const handleRowsChange = useCallback((rows) => {
    setItemsNuevos(rows)
    limpiarPreview()
  }, [limpiarPreview])

  const origenSeleccionado = useMemo(
    () => itemsOrigen.filter((item) => Number(item.cantidad) > 0),
    [itemsOrigen],
  )

  const totalDevolucion = useMemo(
    () => origenSeleccionado.reduce((acc, item) => acc + (Number(item.cantidad) * Number(item.precioUnitario || 0)), 0),
    [origenSeleccionado],
  )

  const buildPreviewPayload = useCallback(() => {
    const items = origenSeleccionado.map((item) => ({
      venta_detalle_item_id: item.origenItemId,
      cantidad: Number(item.cantidad).toFixed(2),
    }))

    const rows = itemsGridRef.current?.getItems?.() || itemsNuevos || []
    const itemsNuevosMapeados = modo === "cambio" ? buildItemsNuevosPayload(rows) : []

    const esCancelacionTotal = itemsOrigen.length > 0 && itemsOrigen.every((item) => (
      Number(item.cantidad) === Number(item.cantidadOriginal)
    ))

    const previewPayload = modo === "cambio"
      ? {
        venta_id: comprobanteId,
        items_devueltos: items,
        items_nuevos: itemsNuevosMapeados,
      }
      : {
        venta_id: comprobanteId,
        modo: esCancelacionTotal ? "CANCELACION_TOTAL" : "DEVOLUCION_PARCIAL",
        items,
      }

    return {
      previewPayload,
      itemsNuevosMapeados,
    }
  }, [comprobanteId, itemsNuevos, itemsOrigen, modo, origenSeleccionado])

  const handlePreview = useCallback(async () => {
    if (origenSeleccionado.length === 0) {
      window.alert("Debe seleccionar al menos un producto.")
      return
    }

    const { previewPayload, itemsNuevosMapeados } = buildPreviewPayload()

    if (modo === "cambio" && itemsNuevosMapeados.length === 0) {
      window.alert("Para un cambio, agrega al menos un producto nuevo.")
      return
    }

    setUltimoPreviewContext(null)

    try {
      if (modo === "cambio") {
        const previewData = await previsualizarCambio(previewPayload)
        setResolucionDiferencia(resolucionDiferenciaPorDefecto(previewData))
        setUltimoPreviewContext({ previewPayload, previewData })
      } else {
        const previewData = await previsualizarDevolucion(previewPayload)
        setResolucionDinero("SALDO_A_FAVOR")
        setUltimoPreviewContext({ previewPayload, previewData })
      }
    } catch {
      return
    }
  }, [buildPreviewPayload, modo, origenSeleccionado.length, previsualizarCambio, previsualizarDevolucion])

  const handleConfirm = useCallback(async () => {
    if (!ultimoPreviewContext) {
      window.alert("Primero revisa el resumen.")
      return
    }

    if (!observacion.trim()) {
      window.alert("Indica el motivo del cambio o la devolucion.")
      return
    }

    const confirmPayload = buildConfirmPayload({
      modo,
      observacion,
      previewPayload: ultimoPreviewContext.previewPayload,
      previewData: ultimoPreviewContext.previewData,
      resolucionDinero,
      resolucionDiferencia,
      mediosPago,
    })

    const resolucion = modo === "cambio" ? resolucionDiferencia : resolucionDinero
    const direccion = direccionMediosPostventa(resolucion)
    const objetivo = obtenerMontoObjetivo(
      modo,
      ultimoPreviewContext.previewData?.resumen_monetario,
      resolucion,
    )
    if (direccion && objetivo > 0) {
      if (mediosPago.length === 0) {
        window.alert("Agrega al menos un medio.")
        return
      }
      if (mediosPago.some((medio) => !medio.metodo_pago_id || Number(medio.monto) <= 0)) {
        window.alert("Cada medio debe tener un metodo y un monto mayor que cero.")
        return
      }
      const totalMedios = calcularTotalMedios(mediosPago)
      if (direccion === "entrada" && totalMedios < objetivo - 0.009) {
        window.alert(`La suma de los medios debe cubrir al menos ${formatMoney(objetivo)}.`)
        return
      }
      if (
        direccion === "entrada" &&
        totalMedios - objetivo > calcularMontoEfectivo(mediosPago, metodosPago) + 0.009
      ) {
        window.alert("El vuelto solo puede descontarse del efectivo recibido.")
        return
      }
      if (direccion === "salida" && Math.abs(totalMedios - objetivo) > 0.009) {
        window.alert(`La suma de los medios debe ser exactamente ${formatMoney(objetivo)}.`)
        return
      }
    }

    let resultado
    try {
      resultado = modo === "cambio"
        ? await confirmarCambio(confirmPayload)
        : await confirmarDevolucion(confirmPayload)
    } catch {
      return
    }
    renewIdempotencyKey()
    setUltimoPreviewContext(null)

    if (onSuccess) {
      await onSuccess(resultado)
    }
  }, [confirmarCambio, confirmarDevolucion, mediosPago, metodosPago, modo, observacion, onSuccess, renewIdempotencyKey, resolucionDiferencia, resolucionDinero, ultimoPreviewContext])

  const vistaPrevia = preview || ultimoPreviewContext?.previewData
  const resumenMonetario = vistaPrevia?.resumen_monetario
  const numeroComprobante = obtenerNumeroComprobante(comprobante, ventaCalculada)
  const clienteNombre = ventaCalculada?.cliente_razon || comprobante?.cliente || comprobante?.cliente_razon || "-"
  const tipoComprobante = ventaCalculada?.comprobante?.nombre || comprobante?.comprobante?.nombre || comprobante?.comprobante_nombre || "Comprobante"
  const itemsVistaPrevia = vistaPrevia?.items_seleccionados || vistaPrevia?.items_devueltos || []
  const itemsNuevosVistaPrevia = vistaPrevia?.items_nuevos || []
  const textoDiferencia = {
    CLIENTE_PAGA: "El cliente paga la diferencia.",
    CLIENTE_RECIBE: "La diferencia queda a favor del cliente.",
    SIN_DIFERENCIA: "El cambio no tiene diferencia monetaria.",
  }[resumenMonetario?.direccion_diferencia]
  const tituloPrincipal = modo === "cambio" ? "Gestionar cambio" : "Gestionar devolucion"
  const subtituloPrincipal = modo === "cambio"
    ? "Selecciona que productos vuelven y cuales se entregan a cambio."
    : "Selecciona que productos se devuelven para dejar saldo a favor."
  const textoBotonConfirmar = modo === "cambio" ? "Confirmar cambio" : "Confirmar devolucion"
  const resolucionActual = modo === "cambio" ? resolucionDiferencia : resolucionDinero
  const direccionMedios = direccionMediosPostventa(resolucionActual)
  const montoObjetivo = obtenerMontoObjetivo(modo, resumenMonetario, resolucionActual)
  const metodosDisponibles = useMemo(
    () => filtrarMetodosPostventa(
      metodosPago,
      direccionMedios,
      cajaAbierta,
      cuentasBanco.length > 0,
    ),
    [cajaAbierta, cuentasBanco.length, direccionMedios, metodosPago],
  )
  const requiereMedio = Boolean(direccionMedios && montoObjetivo > 0)
  const totalMedios = calcularTotalMedios(mediosPago)
  const vuelto = direccionMedios === "entrada"
    ? Math.max(totalMedios - montoObjetivo, 0)
    : 0
  const vueltoEsValido = vuelto <= calcularMontoEfectivo(mediosPago, metodosPago) + 0.009

  useEffect(() => {
    if (!requiereMedio) {
      setMediosPago([])
      return
    }
    setMediosPago((prev) => {
      const idsDisponibles = new Set(metodosDisponibles.map((metodo) => String(metodo.id)))
      const lineasValidas = prev.filter((medio) => idsDisponibles.has(String(medio.metodo_pago_id)))
      const totalActual = lineasValidas.reduce((total, medio) => total + Number(medio.monto || 0), 0)
      if (lineasValidas.length > 0 && Math.abs(totalActual - montoObjetivo) <= 0.009) {
        return lineasValidas
      }
      const metodoInicial = metodosDisponibles.find(
        (metodo) => String(metodo.codigo || "").toLowerCase() === "efectivo",
      ) || metodosDisponibles[0]
      return metodoInicial
        ? [{
          metodo_pago_id: metodoInicial.id,
          monto: montoObjetivo.toFixed(2),
          cuenta_banco_id: "",
          referencia_externa: "",
          observacion: "",
        }]
        : []
    })
  }, [metodosDisponibles, montoObjetivo, requiereMedio])

  const actualizarLineaMedio = (indice, cambios) => {
    setMediosPago((prev) => prev.map((medio, actual) => (
      actual === indice ? { ...medio, ...cambios } : medio
    )))
  }

  const agregarLineaMedio = () => {
    const metodo = metodosDisponibles[0]
    if (!metodo) return
    const remanente = Math.max(montoObjetivo - totalMedios, 0)
    setMediosPago((prev) => [...prev, {
      metodo_pago_id: metodo.id,
      monto: remanente > 0 ? remanente.toFixed(2) : "",
      cuenta_banco_id: "",
      referencia_externa: "",
      observacion: "",
    }])
  }

  if (cargando || loadingAlicuotas) {
    return <p className="text-slate-600 text-center py-10">Cargando datos del comprobante...</p>
  }

  if (detalleError) {
    return <p className="text-red-600 text-center py-10">No se pudieron cargar los productos de esta venta: {detalleError}</p>
  }

  return (
    <div className="relative bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 to-orange-700"></div>

      <div className="px-8 pt-4 pb-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 6h9m-9 6h9m-9 6h5.25M3 5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25v13.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V5.25Z" />
                </svg>
              </div>
              {tituloPrincipal}
            </h3>
            <p className="text-sm text-slate-600">{subtituloPrincipal}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Cliente: <span className="font-semibold text-slate-700">{clienteNombre}</span></div>
            <div>{tipoComprobante} {numeroComprobante}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className={PANEL_CLASS}>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={SECTION_TITLE_CLASS}>Operacion</label>
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="modo-postventa"
                      checked={modo === "devolucion"}
                      onChange={() => handleModoChange("devolucion")}
                    />
                    Devolver productos
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="modo-postventa"
                      checked={modo === "cambio"}
                      onChange={() => handleModoChange("cambio")}
                    />
                    Cambiar por otros productos
                  </label>
                </div>
              </div>

              <div className="col-span-2">
                <label className={SECTION_TITLE_CLASS}>Motivo</label>
                <input
                  type="text"
                  value={observacion}
                  onChange={handleObservacionChange}
                  className={INPUT_CLASS}
                  placeholder="Ej: producto fallado, error de modelo, cambio por otro articulo"
                />
              </div>

              <div className="text-xs text-slate-600">
                <div className="font-semibold text-slate-700 mb-1">Resumen</div>
                <div>Productos seleccionados: {origenSeleccionado.length}</div>
                <div>Total devuelto: {formatMoney(totalDevolucion)}</div>
                {modo === "cambio" && (
                  <div>
                    Total del nuevo pedido: {resumenMonetario?.total_debito != null
                      ? formatMoney(resumenMonetario.total_debito)
                      : "Revisa el resumen"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-800 text-slate-100 px-4 py-2 text-sm font-semibold">
              Productos de la venta
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 uppercase">Codigo</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 uppercase">Detalle</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 uppercase">Unidad</th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-600 uppercase">Cantidad vendida</th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-600 uppercase">
                      {modo === "cambio" ? "Cantidad a cambiar" : "Cantidad a devolver"}
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-600 uppercase">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemsOrigen.map((item, index) => (
                    <tr key={item.key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs font-mono text-slate-700">{item.codigo || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{item.detalle || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{item.unidad || "-"}</td>
                      <td className="px-3 py-2 text-xs text-right text-slate-700">{item.cantidadOriginal}</td>
                      <td className="px-3 py-2 text-xs text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.cantidadOriginal}
                          step="0.01"
                          value={item.cantidad}
                          onChange={(event) => handleCantidadOrigenChange(index, event.target.value)}
                          className={`${INPUT_CLASS} w-24 text-right`}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSeleccionarTodo(index)}
                            className="px-2 py-1 text-[11px] rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Todo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLimpiarFila(index)}
                            className="px-2 py-1 text-[11px] rounded bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Limpiar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {itemsOrigen.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-sm text-slate-500">
                        No se encontraron productos para esta venta. Si deberian aparecer, cierra y vuelve a abrir el comprobante.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {modo === "cambio" && (
          <>
            <div className="mb-4">
              <div className={PANEL_CLASS}>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className={SECTION_TITLE_CLASS}>Producto nuevo</label>
                    <BuscadorProducto onSelect={handleAddItemToGrid} className="w-full" />
                  </div>
                  <div>
                    <label className={SECTION_TITLE_CLASS}>Accion por defecto</label>
                    <SumarDuplicar
                      autoSumarDuplicados={autoSumarDuplicados}
                      setAutoSumarDuplicados={setAutoSumarDuplicados}
                      disabled={false}
                      showLabel={false}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <ItemsGrid
                ref={itemsGridRef}
                autoSumarDuplicados={autoSumarDuplicados}
                setAutoSumarDuplicados={setAutoSumarDuplicados}
                bonificacionGeneral={bonificacionGeneral}
                setBonificacionGeneral={(value) => {
                  setBonificacionGeneral(value)
                  limpiarPreview()
                }}
                descu1={descu1}
                descu2={descu2}
                descu3={descu3}
                setDescu1={(value) => {
                  setDescu1(value)
                  limpiarPreview()
                }}
                setDescu2={(value) => {
                  setDescu2(value)
                  limpiarPreview()
                }}
                setDescu3={(value) => {
                  setDescu3(value)
                  limpiarPreview()
                }}
                totales={totales}
                modo="venta"
                alicuotas={alicuotasMap}
                onRowsChange={handleRowsChange}
                initialItems={normalizarItems(itemsNuevos, { modo: "venta", alicuotasMap })}
              />
            </div>
          </>
        )}

        {(postventaError || vistaPrevia) && (
          <div className="mb-6">
            <div className={`rounded-xl border p-4 ${postventaError ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
              <div className={`text-sm font-semibold mb-2 ${postventaError ? "text-red-700" : "text-slate-700"}`}>
                {postventaError ? "No se pudo procesar la operacion" : "Resumen antes de confirmar"}
              </div>
              {postventaError ? (
                <p className="text-sm text-red-700">{postventaError}</p>
              ) : (
                <div className="space-y-4">
                  {resumenMonetario && (
                    <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                      {"total_credito" in resumenMonetario && (
                        <div className="rounded border border-slate-200 bg-white px-3 py-2">
                          <div className="font-semibold text-slate-500">Credito por devolver</div>
                          <div>{formatMoney(resumenMonetario.total_credito)}</div>
                        </div>
                      )}
                      {"total_debito" in resumenMonetario && (
                        <div className="rounded border border-slate-200 bg-white px-3 py-2">
                          <div className="font-semibold text-slate-500">Nuevo pedido</div>
                          <div>{formatMoney(resumenMonetario.total_debito)}</div>
                        </div>
                      )}
                      {"diferencia" in resumenMonetario && (
                        <div className="rounded border border-slate-200 bg-white px-3 py-2">
                          <div className="font-semibold text-slate-500">Diferencia</div>
                          <div>{formatMoney(resumenMonetario.diferencia)}</div>
                        </div>
                      )}
                      {"saldo_pendiente_venta" in resumenMonetario && (
                        <div className="rounded border border-slate-200 bg-white px-3 py-2">
                          <div className="font-semibold text-slate-500">Saldo pendiente</div>
                          <div>{formatMoney(resumenMonetario.saldo_pendiente_venta)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {modo === "cambio" && resumenMonetario?.diferencia != null && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {textoDiferencia}
                    </div>
                  )}

                  {modo === "devolucion" && (
                    <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      Se genera una nota de credito y el importe queda como saldo a favor del cliente.
                    </div>
                  )}

                  {modo === "devolucion" && (
                    <div className={PANEL_CLASS}>
                      <label className={SECTION_TITLE_CLASS}>Destino del credito</label>
                      <select
                        className={INPUT_CLASS}
                        value={resolucionDinero}
                        onChange={(event) => setResolucionDinero(event.target.value)}
                      >
                        <option value="SALDO_A_FAVOR">Dejar saldo a favor</option>
                        <option value="IMPUTAR_DEUDA">Imputar deuda pendiente</option>
                        <option value="DEVOLVER_DINERO">Devolver dinero</option>
                      </select>
                    </div>
                  )}

                  {modo === "cambio" && resumenMonetario?.direccion_diferencia === "CLIENTE_PAGA" && (
                    <div className={PANEL_CLASS}>
                      <label className={SECTION_TITLE_CLASS}>Destino de la diferencia</label>
                      <select
                        className={INPUT_CLASS}
                        value={resolucionDiferencia}
                        onChange={(event) => setResolucionDiferencia(event.target.value)}
                      >
                        <option value="COBRAR_DIFERENCIA">Cobrar diferencia</option>
                        <option value="DEJAR_DEUDA">Dejar deuda</option>
                      </select>
                    </div>
                  )}

                  {modo === "cambio" && resumenMonetario?.direccion_diferencia === "CLIENTE_RECIBE" && (
                    <div className={PANEL_CLASS}>
                      <label className={SECTION_TITLE_CLASS}>Destino del saldo</label>
                      <select
                        className={INPUT_CLASS}
                        value={resolucionDiferencia}
                        onChange={(event) => setResolucionDiferencia(event.target.value)}
                      >
                        <option value="SALDO_A_FAVOR">Dejar saldo a favor</option>
                        <option value="IMPUTAR_DEUDA">Imputar deuda pendiente</option>
                        <option value="DEVOLVER_DINERO">Devolver dinero</option>
                      </select>
                    </div>
                  )}

                  {requiereMedio && (
                    <div className={PANEL_CLASS}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className={SECTION_TITLE_CLASS}>
                          {direccionMedios === "entrada" ? "Medios de cobro" : "Medios de devolucion"}
                        </label>
                        <span className="text-xs font-semibold text-slate-700">
                          Objetivo: {formatMoney(montoObjetivo)}
                        </span>
                      </div>
                      {metodosDisponibles.length === 0 ? (
                        <p className="text-xs text-red-700">
                          No hay medios habilitados para esta operacion. Verifica la caja abierta y las cuentas bancarias.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {mediosPago.map((medio, indice) => {
                            const metodoSeleccionado = metodosDisponibles.find(
                              (metodo) => String(metodo.id) === String(medio.metodo_pago_id),
                            )
                            const esBancario = esMedioBancario(metodoSeleccionado)
                            return (
                              <div key={`${indice}-${medio.metodo_pago_id}`} className="grid gap-2 rounded border border-slate-200 bg-white p-2 md:grid-cols-12">
                                <select
                                  className={`${INPUT_CLASS} md:col-span-4`}
                                  value={medio.metodo_pago_id}
                                  onChange={(event) => actualizarLineaMedio(indice, {
                                    metodo_pago_id: event.target.value,
                                    cuenta_banco_id: "",
                                    referencia_externa: "",
                                  })}
                                >
                                  {metodosDisponibles.map((metodo) => (
                                    <option key={metodo.id} value={metodo.id}>{metodo.nombre}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  className={`${INPUT_CLASS} md:col-span-2 text-right`}
                                  value={medio.monto}
                                  onChange={(event) => actualizarLineaMedio(indice, { monto: event.target.value })}
                                  placeholder="Monto"
                                />
                                {esBancario ? (
                                  <>
                                    <select
                                      className={`${INPUT_CLASS} md:col-span-3`}
                                      value={medio.cuenta_banco_id}
                                      onChange={(event) => actualizarLineaMedio(indice, { cuenta_banco_id: event.target.value })}
                                    >
                                      <option value="">Selecciona una cuenta</option>
                                      {cuentasBanco.map((cuenta) => (
                                        <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                                      ))}
                                    </select>
                                    <input
                                      className={`${INPUT_CLASS} md:col-span-2`}
                                      value={medio.referencia_externa}
                                      onChange={(event) => actualizarLineaMedio(indice, { referencia_externa: event.target.value })}
                                      placeholder="Referencia"
                                    />
                                  </>
                                ) : <div className="md:col-span-5" />}
                                <button
                                  type="button"
                                  onClick={() => setMediosPago((prev) => prev.filter((_, actual) => actual !== indice))}
                                  className="text-xs text-red-700 hover:text-red-900 md:col-span-1"
                                >
                                  Quitar
                                </button>
                              </div>
                            )
                          })}
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={agregarLineaMedio}
                              className="text-xs font-semibold text-orange-700 hover:text-orange-900"
                            >
                              + Agregar otro medio
                            </button>
                            <span className={(direccionMedios === "entrada"
                              ? totalMedios >= montoObjetivo - 0.009 && vueltoEsValido
                              : Math.abs(totalMedios - montoObjetivo) <= 0.009)
                              ? "text-xs font-semibold text-green-700"
                              : "text-xs font-semibold text-red-700"}
                            >
                              {direccionMedios === "entrada" ? "Recibido" : "Aplicado"}: {formatMoney(totalMedios)}
                            </span>
                          </div>
                          {vuelto > 0 && (
                            <div className="flex items-center justify-end gap-3 text-xs">
                              <span className="text-slate-600">Vuelto</span>
                              <span className="font-semibold text-slate-700">{formatMoney(vuelto)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-700">
                        {modo === "cambio" ? "Productos que vuelven" : "Productos devueltos"}
                      </div>
                      <div className="space-y-2">
                        {itemsVistaPrevia.map((item) =>
                          renderLineaProductoVista(
                            item,
                            item.venta_detalle_item_id,
                            modo === "cambio" ? "cantidad_solicitada" : "cantidad_solicitada",
                            "subtotal_credito",
                          ),
                        )}
                      </div>
                    </div>

                    {modo === "cambio" && (
                      <div>
                        <div className="mb-2 text-xs font-semibold text-slate-700">Productos que se entregan</div>
                        <div className="space-y-2">
                          {itemsNuevosVistaPrevia.map((item) =>
                            renderLineaProductoVista(item, item.stock_id, "cantidad", "subtotal_debito"),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || confirmLoading}
            className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-all duration-200 font-semibold shadow-lg"
          >
            {previewLoading ? "Preparando..." : "Revisar resumen"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ultimoPreviewContext || previewLoading || confirmLoading}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 disabled:opacity-60 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
          >
            {confirmLoading ? "Confirmando..." : textoBotonConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PostventaForm
