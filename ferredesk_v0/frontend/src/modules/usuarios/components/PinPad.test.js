import React, { act } from "react"
import { createRoot } from "react-dom/client"
import PinPad from "./PinPad"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function boton(container, ariaLabel) {
  return container.querySelector(`button[aria-label="${ariaLabel}"]`)
}

describe("PinPad", () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  test("acepta teclado fisico y envia seis digitos", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<PinPad onSubmit={onSubmit} />))
    const input = container.querySelector("#perfil-pin")

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(input, "123456")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => boton(container, "Confirmar PIN").click())

    expect(onSubmit).toHaveBeenCalledWith("123456")
    expect(input.value).toBe("")
  })

  test("limpia el PIN cuando la identificacion falla", async () => {
    const error = Object.assign(new Error("No fue posible identificar el perfil."), {
      status: 403,
      code: "identificacion_fallida",
    })
    const onSubmit = jest.fn().mockRejectedValue(error)
    await act(async () => root.render(<PinPad onSubmit={onSubmit} />))

    for (const digito of ["1", "2", "3", "4", "5", "6"]) {
      await act(async () => boton(container, `Ingresar ${digito}`).click())
    }
    await act(async () => boton(container, "Confirmar PIN").click())

    expect(container.querySelector("#perfil-pin").value).toBe("")
    expect(container.textContent).toContain("No fue posible identificar el perfil.")
  })

  test("deshabilita el envio mientras espera", async () => {
    const esperaHasta = new Date(Date.now() + 30000).toISOString()
    await act(async () => root.render(<PinPad esperaHasta={esperaHasta} onSubmit={jest.fn()} />))

    expect(boton(container, "Confirmar PIN").disabled).toBe(true)
    expect(container.textContent).toContain("Espera")
  })

  test("aplica Retry-After cuando el backend activa la espera", async () => {
    const error = Object.assign(new Error("Espera activa"), {
      status: 429,
      code: "pin_espera_activa",
      retryAfter: "30",
    })
    const onSubmit = jest.fn().mockRejectedValue(error)
    await act(async () => root.render(<PinPad onSubmit={onSubmit} />))

    for (const digito of ["1", "2", "3", "4", "5", "6"]) {
      await act(async () => boton(container, `Ingresar ${digito}`).click())
    }
    await act(async () => boton(container, "Confirmar PIN").click())

    expect(boton(container, "Confirmar PIN").disabled).toBe(true)
    expect(container.textContent).toContain("Espera 30 s")
  })
})
