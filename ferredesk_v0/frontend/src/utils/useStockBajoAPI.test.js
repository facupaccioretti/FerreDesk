import { construirQuery, fetchStockBajo } from "./useStockBajoAPI"


describe("useStockBajoAPI", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test("construye parametros sin valores vacios", () => {
    expect(construirQuery({ search: "pinza", page: 2, limit: 20, familia: "" }))
      .toBe("?search=pinza&page=2&limit=20")
  })

  test("obtiene y normaliza productos paginados", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        count: 1,
        results: [{ codigo_venta: "P-100", denominacion: "Pinza", stock_total: 1 }],
      }),
    })

    const resultado = await fetchStockBajo({ search: "pinza", page: 2, limit: 20 })

    expect(global.fetch).toHaveBeenCalledWith("/api/informes/stock-bajo/?search=pinza&page=2&limit=20", {
      credentials: "include",
    })
    expect(resultado.productos).toHaveLength(1)
    expect(resultado.totalProductos).toBe(1)
  })

  test("rechaza la consulta fallida", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false })

    await expect(fetchStockBajo({})).rejects.toThrow("Error al obtener datos de stock bajo")
  })
})
