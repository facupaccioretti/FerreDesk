import React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let mockPathnameActual = "/home/productos"
const mockUseProcessContext = jest.fn()

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ pathname: mockPathnameActual }),
  }),
  { virtual: true }
)

jest.mock("../../context/ProcessContext", () => ({
  useProcessContext: (...args) => mockUseProcessContext(...args),
}))

jest.mock("../../hooks/useFerreDeskTheme", () => ({
  useFerreDeskTheme: () => ({
    botonPrimario: "boton-tema",
  }),
}))

const ProcessRouteGate = require("./ProcessRouteGate").default
const { esRutaSensibles } = require("./ProcessRouteGate")

function esperarMicrotareas() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

async function renderGate({ pathname = "/home/productos", procesosActivos = [] } = {}) {
  mockPathnameActual = pathname
  mockUseProcessContext.mockReturnValue({
    procesosActivos,
    setDrawerOpen: jest.fn(),
  })

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <ProcessRouteGate>
        <div>contenido sensible</div>
      </ProcessRouteGate>
    )
    await esperarMicrotareas()
  })

  return {
    container,
    desmontar: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe("ProcessRouteGate", () => {
  afterEach(() => {
    mockUseProcessContext.mockReset()
    document.body.innerHTML = ""
  })

  test("detecta rutas sensibles del flujo operativo", () => {
    expect(esRutaSensibles("/home/productos")).toBe(true)
    expect(esRutaSensibles("/home/compras")).toBe(true)
    expect(esRutaSensibles("/home/presupuestos/nuevo")).toBe(true)
    expect(esRutaSensibles("/home")).toBe(false)
    expect(esRutaSensibles("/home/informes")).toBe(false)
  })

  test("bloquea una ruta sensible cuando hay un proceso critico activo (bloqueo desactivado)", async () => {
    const vista = await renderGate({
      pathname: "/home/productos",
      procesosActivos: [
        {
          id: 1,
          tipo: "actualizacion_lista_precios",
          titulo: "Actualizacion de precios de ZONTA",
          impacto_operativo: "critico",
          proveedorNombre: "ZONTA",
          registros_procesados: 42,
        },
      ],
    })

    // El bloqueo de pantalla fue desactivado por pedido del usuario, por lo que el contenido debe estar visible
    expect(vista.container.textContent).toContain("contenido sensible")

    await vista.desmontar()
  })

  test("permite render normal en rutas no sensibles aunque exista un proceso activo", async () => {
    const vista = await renderGate({
      pathname: "/home/informes",
      procesosActivos: [
        {
          id: 2,
          tipo: "carga_inicial_proveedor",
          titulo: "Carga inicial de LEKONS",
          impacto_operativo: "critico",
        },
      ],
    })

    expect(vista.container.textContent).toContain("contenido sensible")

    await vista.desmontar()
  })
})
