import { useState, useMemo, useCallback } from "react"
import { fechaHoyLocal } from "../../../utils/fechas"

/**
 * Hook personalizado para gestionar filtros, normalización y paginación de comprobantes
 * Extraído de PresupuestosManager.js
 * 
 * @param {Object} dependencies - Dependencias requeridas
 * @param {Array} dependencies.ventas - Lista de ventas desde la API
 * @param {Array} dependencies.productos - Lista de productos
 * @param {Array} dependencies.clientes - Lista de clientes
 * @param {Function} dependencies.fetchVentas - Función para actualizar lista de ventas
 */
const useFiltrosComprobantes = ({
  ventas,
  productos,
  clientes,
  fetchVentas,
}) => {
  // Estados de filtros
  const [comprobanteTipo, setComprobanteTipo] = useState("")
  const [comprobanteLetra, setComprobanteLetra] = useState("")

  // Inicializar rango de fechas: hoy y 30 días atrás
  const hoyISO = (() => {
    const d = new Date()
    const mes = String(d.getMonth() + 1).padStart(2, "0")
    const dia = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${mes}-${dia}`
  })()

  const hace30ISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const mes = String(d.getMonth() + 1).padStart(2, "0")
    const dia = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${mes}-${dia}`
  })()

  const [fechaDesde, setFechaDesde] = useState(hace30ISO)
  const [fechaHasta, setFechaHasta] = useState(hoyISO)
  const [clienteId, setClienteId] = useState("")
  const [vendedorId, setVendedorId] = useState("")

  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(15)

  // Mapas para accesos O(1)
  const productosPorId = useMemo(() => {
    const m = new Map()
    productos.forEach((p) => m.set(p.id, p))
    return m
  }, [productos])

  const clientesPorId = useMemo(() => {
    const m = new Map()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  /**
   * Función normalizadora memorizada para transformar datos de ventas
   * @param {Object} venta - Datos de venta sin normalizar
   * @returns {Object|null} - Datos normalizados o null si no es válido
   */
  const normalizarVenta = useCallback(
    (venta) => {
      const comprobanteObj = typeof venta.comprobante === "object" ? venta.comprobante : null
      if (!comprobanteObj) return null

      const esPresupuesto =
        (comprobanteObj.tipo && comprobanteObj.tipo.toLowerCase() === "presupuesto") ||
        comprobanteObj.codigo_afip === "9997"

      const tipo = esPresupuesto ? "Presupuesto" : "Venta"
      const estado = venta.estado || (venta.ven_estado === "AB" ? "Abierto" : venta.ven_estado === "CE" ? "Cerrado" : "")

      const items = (venta.items || venta.detalle || venta.productos || []).map((item) => {
        const producto = productosPorId.get(item.vdi_idsto || item.producto?.id) || null
        const cantidad = Number.parseFloat(item.vdi_cantidad || item.cantidad || 0)
        const costo = Number.parseFloat(item.vdi_importe || item.precio || item.costo || 0)
        const bonificacion = Number.parseFloat(item.vdi_bonifica || item.bonificacion || 0)
        const subtotalSinIva = costo * cantidad * (bonificacion ? 1 - bonificacion / 100 : 1)
        const alicuotaIva = producto ? Number.parseFloat(producto.aliiva?.porce || producto.aliiva || 0) || 0 : 0
        const iva = subtotalSinIva * (alicuotaIva / 100)
        return {
          ...item,
          producto,
          codigo: producto?.codvta || producto?.codigo || item.codigo || item.codvta || item.id || "-",
          denominacion: producto?.deno || producto?.nombre || item.denominacion || item.nombre || "",
          unidad: producto?.unidad || producto?.unidadmedida || item.unidad || item.unidadmedida || "-",
          cantidad,
          precio: costo,
          bonificacion,
          alicuotaIva,
          iva,
        }
      })

      return {
        ...venta,
        tipo,
        estado,
        letra: comprobanteObj.letra || venta.letra || "",
        numero: venta.numero_formateado || venta.ven_numero || venta.numero || "",
        cliente:
          clientesPorId.get(venta.ven_idcli)?.razon ||
          (venta.ven_idcli === 1 || venta.ven_idcli === "1" ? "Cliente Mostrador" : "") ||
          venta.cliente_razon ||
          venta.cliente ||
          "",
        fecha: venta.ven_fecha || venta.fecha || fechaHoyLocal(),
        id: venta.ven_id || venta.id || venta.pk,
        items,
        plazoId: venta.ven_idpla || venta.plazoId || "",
        vendedorId: venta.ven_idvdo || venta.vendedorId || "",
        sucursalId: venta.ven_sucursal || venta.sucursalId || 1,
        puntoVentaId: venta.ven_punto || venta.puntoVentaId || 1,
        bonificacionGeneral: venta.ven_bonificacion_general ?? venta.bonificacionGeneral ?? 0,
        descu1: venta.ven_descu1 || venta.descu1 || 0,
        descu2: venta.ven_descu2 || venta.descu2 || 0,
        descu3: venta.ven_descu3 || venta.descu3 || 0,
        copia: venta.ven_copia || venta.copia || 1,
        cae: venta.ven_cae || venta.cae || "",
        comprobante: comprobanteObj,
        total: venta.total || venta.ven_total || venta.importe_total || 0,
      }
    },
    [productosPorId, clientesPorId]
  )

  /**
   * Datos normalizados de ventas
   */
  const ventasNormalizadas = useMemo(() => {
    return ventas
      .filter(v => v.comprobante?.tipo !== 'recibo')
      .map(normalizarVenta)
      .filter(Boolean)
  }, [ventas, normalizarVenta])

  /**
   * Cálculos de paginación
   */
  const totalItems = ventasNormalizadas.length
  const datosPagina = ventasNormalizadas.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina)

  /**
   * Maneja los cambios en los filtros y actualiza la lista de ventas
   * @param {Object} filtros - Objeto con los nuevos valores de filtros
   */
  const handleFiltroChange = (filtros) => {
    setComprobanteTipo(filtros.comprobanteTipo)
    setComprobanteLetra(filtros.comprobanteLetra)
    setFechaDesde(filtros.fechaDesde)
    setFechaHasta(filtros.fechaHasta)
    setClienteId(filtros.clienteId)
    setVendedorId(filtros.vendedorId)

    const params = {}
    if (filtros.comprobanteTipo) params["comprobante_tipo"] = filtros.comprobanteTipo
    if (filtros.comprobanteLetra) params["comprobante_letra"] = filtros.comprobanteLetra
    if (filtros.fechaDesde) params["ven_fecha_after"] = filtros.fechaDesde
    if (filtros.fechaHasta) params["ven_fecha_before"] = filtros.fechaHasta
    if (filtros.clienteId) params["ven_idcli"] = filtros.clienteId
    if (filtros.vendedorId) params["ven_idvdo"] = filtros.vendedorId

    fetchVentas(params)
  }

  /**
   * Resetea todos los filtros a sus valores por defecto
   */
  const resetearFiltros = () => {
    setComprobanteTipo("")
    setComprobanteLetra("")
    setFechaDesde(hace30ISO)
    setFechaHasta(hoyISO)
    setClienteId("")
    setVendedorId("")
    setPaginaActual(1)
    fetchVentas({})
  }

  /**
   * Obtiene el estado actual de todos los filtros
   * @returns {Object} - Objeto con todos los valores de filtros actuales
   */
  const obtenerFiltrosActuales = () => ({
    comprobanteTipo,
    comprobanteLetra,
    fechaDesde,
    fechaHasta,
    clienteId,
    vendedorId,
  })

  return {
    // Estados de filtros
    comprobanteTipo,
    setComprobanteTipo,
    comprobanteLetra,
    setComprobanteLetra,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    clienteId,
    setClienteId,
    vendedorId,
    setVendedorId,

    // Estados de paginación
    paginaActual,
    setPaginaActual,
    itemsPorPagina,
    setItemsPorPagina,

    // Datos normalizados y paginados
    ventasNormalizadas,
    totalItems,
    datosPagina,

    // Funciones
    handleFiltroChange,
    resetearFiltros,
    obtenerFiltrosActuales,

    // Mapas para acceso rápido
    productosPorId,
    clientesPorId,

    // Función de normalización
    normalizarVenta,
  }
}

export default useFiltrosComprobantes 