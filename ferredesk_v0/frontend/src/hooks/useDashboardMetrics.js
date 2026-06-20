import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../core/query/queryKeys"
import { withQueryProfile } from "../core/query/queryProfiles"
import { clienteAPI } from "../utils/clienteAPI"

const DASHBOARD_RESOURCE_KEYS = {
  ventas: "dashboard-ventas-por-dia",
  clientes: "dashboard-clientes-mas-ventas",
  productos: "dashboard-productos-mas-vendidos",
}

const MONEDA_LOCALE = "es-AR"

const formatearMoneda = (valor) =>
  `$${Number(valor || 0).toLocaleString(MONEDA_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const normalizarNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const truncarTexto = (texto, maximo = 18) => {
  if (!texto) return "Sin datos"
  if (texto.length <= maximo) return texto
  return `${texto.slice(0, maximo - 1)}…`
}

const normalizarSerie = (respuesta, { top = null, shortName = true } = {}) => {
  const labels = Array.isArray(respuesta?.labels) ? respuesta.labels : []
  const valores = Array.isArray(respuesta?.datasets?.[0]?.data) ? respuesta.datasets[0].data : []

  const serie = labels.map((label, index) => {
    const nombre = String(label || "Sin datos")
    return {
      name: nombre,
      shortName: shortName ? truncarTexto(nombre, 20) : nombre,
      value: normalizarNumero(valores[index]),
    }
  })

  return top ? serie.slice(0, top) : serie
}

export function useDashboardMetrics({
  periodoVentas = "7d",
  metricaClientes = "total",
  metricaProductos = "cantidad",
} = {}) {
  const ventasQuery = useQuery({
    queryKey: queryKeys.resources.list(DASHBOARD_RESOURCE_KEYS.ventas, { periodo: periodoVentas }),
    queryFn: () => clienteAPI(`/api/home/ventas-por-dia/?periodo=${periodoVentas}`),
    ...withQueryProfile("expensiveReport", {
      placeholderData: (prev) => prev,
    }),
  })

  const clientesQuery = useQuery({
    queryKey: queryKeys.resources.list(DASHBOARD_RESOURCE_KEYS.clientes, { tipo: metricaClientes }),
    queryFn: () => clienteAPI(`/api/home/clientes-mas-ventas/?tipo=${metricaClientes}`),
    ...withQueryProfile("expensiveReport", {
      placeholderData: (prev) => prev,
    }),
  })

  const productosQuery = useQuery({
    queryKey: queryKeys.resources.list(DASHBOARD_RESOURCE_KEYS.productos, { tipo: metricaProductos }),
    queryFn: () => clienteAPI(`/api/home/productos-mas-vendidos/?tipo=${metricaProductos}`),
    ...withQueryProfile("expensiveReport", {
      placeholderData: (prev) => prev,
    }),
  })

  const metrics = useMemo(() => {
    const ventas = normalizarSerie(ventasQuery.data)
    const total = ventas.reduce((acc, item) => acc + item.value, 0)
    const promedio = ventas.length > 0 ? total / ventas.length : null
    const topClient = clientesQuery.data?.labels?.[0] || "N/A"
    const topProduct = productosQuery.data?.labels?.[0] || "N/A"

    return {
      totalVentas: ventas.length > 0 ? formatearMoneda(total) : "N/A",
      promedioVentas: promedio !== null ? formatearMoneda(promedio) : "N/A",
      clienteMasVentas: topClient,
      productoMasVendido: topProduct,
    }
  }, [ventasQuery.data, clientesQuery.data, productosQuery.data])

  const charts = useMemo(
    () => ({
      ventasPorDia: normalizarSerie(ventasQuery.data, { shortName: false }),
      clientesMasVentas: normalizarSerie(clientesQuery.data, { top: 5 }),
      productosMasVendidos: normalizarSerie(productosQuery.data, { top: 5 }),
    }),
    [ventasQuery.data, clientesQuery.data, productosQuery.data]
  )

  return {
    metrics,
    charts,
    queries: {
      ventas: ventasQuery,
      clientes: clientesQuery,
      productos: productosQuery,
    },
    loadingMetrics:
      ventasQuery.isLoading || clientesQuery.isLoading || productosQuery.isLoading,
  }
}
