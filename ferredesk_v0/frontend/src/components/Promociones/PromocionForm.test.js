import React, { act } from "react"
import { createRoot } from "react-dom/client"

import PromocionForm from "./PromocionForm"

jest.mock("./EditorComponentesPromo", () => () => null)


describe("PromocionForm", () => {
  let container
  let root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.removeChild(container)
  })

  test("rechaza un producto repetido entre items fijos y grupos", async () => {
    const onGuardar = jest.fn()
    const promocion = {
      id: 1,
      nombre: "Promo repetida",
      precio_promocional: "100.00",
      items: [{
        stock_id: 10,
        codigo: "REP-10",
        denominacion: "Producto repetido",
        cantidad: "1.00",
      }],
      grupos: [{
        id: 2,
        nombre: "Alternativas",
        cantidad: "1.00",
        alternativas: [
          { stock_id: 10, codigo: "REP-10", denominacion: "Producto repetido" },
          { stock_id: 11, codigo: "ALT-11", denominacion: "Alternativa valida" },
        ],
      }],
    }

    await act(async () => {
      root.render(
        <PromocionForm
          promocion={promocion}
          onGuardar={onGuardar}
          onCancelar={() => {}}
        />
      )
    })

    await act(async () => {
      container.querySelector("form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      )
    })

    expect(onGuardar).not.toHaveBeenCalled()
    expect(container.textContent).toContain(
      'El producto "Producto repetido" esta repetido en la promocion.'
    )
  })
})
