import React, { act } from "react"
import { createRoot } from "react-dom/client"

const { useStockBajoAPI } = require("./useStockBajoAPI")

function HookHarness({ onReady }) {
  const api = useStockBajoAPI()

  React.useEffect(() => {
    onReady(api)
  }, [api, onReady])

  return null
}

describe("useStockBajoAPI", () => {
  let container
  let root
  let api

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    global.fetch = jest.fn()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root.render(<HookHarness onReady={(value) => { api = value }} />)
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    document.body.removeChild(container)
    jest.resetAllMocks()
  })

  test("no dispara la consulta automaticamente al montar", () => {
    expect(global.fetch).not.toHaveBeenCalled()
    expect(api.productos).toEqual([])
    expect(api.totalProductos).toBe(0)
    expect(api.loading).toBe(false)
  })

  test("obtiene productos y permite limpiar resultados", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          {
            codigo_venta: "P-100",
            denominacion: "Pinza",
            stock_total: 1,
          },
        ],
      }),
    })

    await act(async () => {
      await api.obtenerProductosStockBajo({ search: "pinza", page: 2, limit: 20 })
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/informes/stock-bajo/?search=pinza&page=2&limit=20", {
      credentials: "include",
    })
    expect(api.productos).toHaveLength(1)
    expect(api.totalProductos).toBe(1)
    expect(api.error).toBe(null)

    await act(async () => {
      api.limpiarResultados()
    })

    expect(api.productos).toEqual([])
    expect(api.totalProductos).toBe(0)
    expect(api.error).toBe(null)
  })

  test("resetea resultados cuando la consulta falla", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
    })

    await act(async () => {
      await api.obtenerProductosStockBajo()
    })

    expect(api.productos).toEqual([])
    expect(api.totalProductos).toBe(0)
    expect(api.error).toBe("Error al obtener datos de stock bajo")
    expect(api.loading).toBe(false)
  })
})
