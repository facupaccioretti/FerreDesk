import React, { act } from "react"
import { createRoot } from "react-dom/client"
import usePostventaAPI, { esUUID, generarIdempotencyKey } from "./usePostventaAPI"

describe("usePostventaAPI", () => {
  let container
  let root
  let api

  function HookProbe() {
    api = usePostventaAPI(42)
    return null
  }

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.sessionStorage.setItem("postventa:idempotency:42", "123e4567-e89b-42d3-a456-426614174000")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<HookProbe />))
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.removeChild(container)
    window.sessionStorage.clear()
    jest.restoreAllMocks()
  })

  test("generates a valid UUID", () => {
    expect(esUUID(generarIdempotencyKey())).toBe(true)
  })

  test("rejects legacy non UUID values", () => {
    expect(esUUID("postventa-123-abc")).toBe(false)
  })

  test("confirma el cambio contra el endpoint real con idempotencia", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ operacion_id: 8 }),
    })

    await act(async () => {
      await expect(api.confirmarCambio({ venta_id: 42, motivo: "Cambio" }))
        .resolves.toEqual({ operacion_id: 8 })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/postventa/cambios/confirmar/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Idempotency-Key": "123e4567-e89b-42d3-a456-426614174000" }),
        body: JSON.stringify({
          venta_id: 42,
          motivo: "Cambio",
          idempotency_key: "123e4567-e89b-42d3-a456-426614174000",
        }),
      }),
    )
  })

  test("descarta una previsualizacion vieja si llega despues de la nueva", async () => {
    let resolverPrimera
    let resolverSegunda
    const primera = new Promise((resolve) => { resolverPrimera = resolve })
    const segunda = new Promise((resolve) => { resolverSegunda = resolve })
    global.fetch = jest.fn()
      .mockReturnValueOnce(primera)
      .mockReturnValueOnce(segunda)

    let resultadoPrimero
    let resultadoSegundo
    await act(async () => {
      resultadoPrimero = api.previsualizarDevolucion({ venta_id: 42, items: [{ cantidad: "1.00" }] })
      resultadoSegundo = api.previsualizarDevolucion({ venta_id: 42, items: [{ cantidad: "2.00" }] })
    })
    await act(async () => {
      resolverSegunda({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ resumen_monetario: { total_credito: "200.00" } }),
      })
      await resultadoSegundo
    })
    await act(async () => {
      resolverPrimera({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ resumen_monetario: { total_credito: "100.00" } }),
      })
      await resultadoPrimero
    })

    await expect(resultadoPrimero).resolves.toBeNull()
    await expect(resultadoSegundo).resolves.toEqual({ resumen_monetario: { total_credito: "200.00" } })
    expect(api.preview).toEqual({ resumen_monetario: { total_credito: "200.00" } })
  })

  test("no envia dos confirmaciones mientras la primera sigue pendiente", async () => {
    let resolver
    global.fetch = jest.fn().mockReturnValue(new Promise((resolve) => { resolver = resolve }))

    let primera
    let segunda
    await act(async () => {
      primera = api.confirmarDevolucion({ venta_id: 42, motivo: "Devolucion" })
      segunda = api.confirmarDevolucion({ venta_id: 42, motivo: "Devolucion" })
    })

    await expect(segunda).resolves.toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolver({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ operacion_id: 9 }),
      })
      await primera
    })
    await expect(primera).resolves.toEqual({ operacion_id: 9 })
  })

  test("reintenta un timeout con la misma clave de idempotencia", async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ operacion_id: 10 }),
      })

    await act(async () => {
      await expect(api.confirmarDevolucion({ venta_id: 42, motivo: "Timeout" })).rejects.toThrow("timeout")
    })
    await act(async () => {
      await expect(api.confirmarDevolucion({ venta_id: 42, motivo: "Timeout" }))
        .resolves.toEqual({ operacion_id: 10 })
    })

    const [primera, segunda] = global.fetch.mock.calls
    expect(primera[1].headers["X-Idempotency-Key"]).toBe("123e4567-e89b-42d3-a456-426614174000")
    expect(segunda[1].headers["X-Idempotency-Key"]).toBe("123e4567-e89b-42d3-a456-426614174000")
  })
})
