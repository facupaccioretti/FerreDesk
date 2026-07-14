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
})
