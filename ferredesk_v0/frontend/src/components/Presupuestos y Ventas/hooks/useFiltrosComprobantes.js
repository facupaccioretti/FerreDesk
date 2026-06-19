import { useState, useMemo, useCallback, useEffect } from "react"
import { fechaHoyLocal } from "../../../utils/fechas"

/**
 * Hook personalizado para gestionar filtros, normalizacion y paginacion de comprobantes.
 */
const useFiltrosComprobantes = ({
  ventas,
  productos,
  clientes,
  pagination,
  fetchVentas,
}) => {
  const [comprobanteTipo, setComprobanteTipo] = useState("")
  const [comprobanteLetra, setComprobanteLetra] = useState("")

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
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(15)

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

  const ventasNormalizadas = useMemo(() => {
    return ventas
      .filter((v) => v.comprobante?.tipo !== "recibo")
      .map(normalizarVenta)
      .filter(Boolean)
  }, [ventas, normalizarVenta])

  const totalItems = pagination?.count ?? ventasNormalizadas.length
  const datosPagina = ventasNormalizadas

  const construirParametros = useCallback(() => {
    const params = {}
    if (comprobanteTipo) params["comprobante_tipo"] = comprobanteTipo
    if (comprobanteLetra) params["comprobante_letra"] = comprobanteLetra
    if (fechaDesde) params["ven_fecha_after"] = fechaDesde
    if (fechaHasta) params["ven_fecha_before"] = fechaHasta
    if (clienteId) params["ven_idcli"] = clienteId
    if (vendedorId) params["ven_idvdo"] = vendedorId
    return params
  }, [comprobanteTipo, comprobanteLetra, fechaDesde, fechaHasta, clienteId, vendedorId])

  useEffect(() => {
    fetchVentas(construirParametros(), {
      page: paginaActual,
      limit: itemsPorPagina,
    }).catch(() => {})
  }, [construirParametros, fetchVentas, paginaActual, itemsPorPagina])

  const handleFiltroChange = (filtros) => {
    setComprobanteTipo(filtros.comprobanteTipo)
    setComprobanteLetra(filtros.comprobanteLetra)
    setFechaDesde(filtros.fechaDesde)
    setFechaHasta(filtros.fechaHasta)
    setClienteId(filtros.clienteId)
    setVendedorId(filtros.vendedorId)
    setPaginaActual(1)
  }

  const resetearFiltros = () => {
    setComprobanteTipo("")
    setComprobanteLetra("")
    setFechaDesde(hace30ISO)
    setFechaHasta(hoyISO)
    setClienteId("")
    setVendedorId("")
    setPaginaActual(1)
  }

  const obtenerFiltrosActuales = () => ({
    comprobanteTipo,
    comprobanteLetra,
    fechaDesde,
    fechaHasta,
    clienteId,
    vendedorId,
  })

  return {
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
    paginaActual,
    setPaginaActual,
    itemsPorPagina,
    setItemsPorPagina,
    ventasNormalizadas,
    totalItems,
    datosPagina,
    handleFiltroChange,
    resetearFiltros,
    obtenerFiltrosActuales,
    productosPorId,
    clientesPorId,
    normalizarVenta,
  }
}

export default useFiltrosComprobantes
