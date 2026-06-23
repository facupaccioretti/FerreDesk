import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mockClienteAPI = jest.fn()

jest.mock("../../utils/clienteAPI", () => ({
  clienteAPI: (...args) => mockClienteAPI(...args),
}))

const ControlFondosTab = require("./ControlFondosTab").default

function createPayload() {
  return {
    resumen_actual: {
      kpis: {
        disponible_hoy: { monto: "1500.00", descripcion: "Liquidez inmediata registrada" },
        caja: { monto: "500.00", descripcion: "Efectivo vigente en sesiones abiertas" },
        bancos: { monto: "1000.00", descripcion: "Fondos registrados en cuentas y billeteras" },
        cheques_en_cartera: { monto: "250.00", descripcion: "Valores fisicos aun no depositados" },
        pendiente_acreditacion: { monto: "300.00", descripcion: "Cheques depositados aun no acreditados" },
        total_administrado: { monto: "2050.00", descripcion: "Fondos y valores administrados por Tesoreria" },
      },
    },
    composicion: {
      disponible_hoy: {
        total: "1500.00",
        componentes: [
          { codigo: "caja", monto: "500.00" },
          { codigo: "bancos", monto: "1000.00" },
        ],
      },
      total_administrado: {
        total: "2050.00",
        componentes: [
          { codigo: "caja", monto: "500.00" },
          { codigo: "bancos", monto: "1000.00" },
          { codigo: "cheques_en_cartera", monto: "250.00" },
          { codigo: "pendiente_acreditacion", monto: "300.00" },
        ],
      },
    },
    seniales: {
      hay_caja_abierta: true,
      cantidad_cuentas_activas: 2,
      cantidad_cheques_pendientes: 1,
    },
    drilldown: {
      disponible_hoy: { tab: "control_fondos", vista_inicial: "composicion" },
      bancos: { tab: "bancos", vista_inicial: "listado", filtro_inicial: null },
      cheques_en_cartera: {
        tab: "cheques",
        vista_inicial: "operativo",
        filtro_inicial: "EN_CARTERA",
      },
      pendiente_acreditacion: {
        tab: "cheques",
        vista_inicial: "historial",
        filtro_inicial: "DEPOSITADO",
      },
      total_administrado: { tab: "control_fondos", vista_inicial: "composicion" },
    },
  }
}

function findClosestButtonByText(container, text) {
  const elements = Array.from(container.querySelectorAll("*"))
  const matchingElement = elements.find(
    (element) => element.textContent?.includes(text) && typeof element.closest === "function"
  )
  return matchingElement?.closest("button")
}

async function waitForText(container, text, attempts = 10) {
  for (let index = 0; index < attempts; index += 1) {
    if (container.textContent?.includes(text)) {
      return
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  throw new Error(`No se encontro el texto esperado: ${text}`)
}

describe("ControlFondosTab", () => {
  let container
  let root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    window.history.replaceState({}, "", "/tesoreria")
    mockClienteAPI.mockResolvedValue(createPayload())
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    document.body.removeChild(container)
    jest.clearAllMocks()
  })

  async function renderControlFondos(props = {}) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          gcTime: Infinity,
          refetchOnWindowFocus: false,
        },
      },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ControlFondosTab {...props} />
        </QueryClientProvider>
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    await waitForText(container, "Control de Fondos")

    return queryClient
  }

  test("renderiza los kpis principales y usa un solo fetch para la pantalla", async () => {
    await renderControlFondos()

    expect(mockClienteAPI).toHaveBeenCalledTimes(1)
    expect(mockClienteAPI).toHaveBeenCalledWith("/api/caja/control-fondos/")
    expect(container.textContent).toContain("Control de Fondos")
    expect(container.textContent).toContain("Disponible hoy")
    expect(container.textContent).toContain("Total administrado")
    expect(container.textContent).toContain("$1.500,00")
    expect(container.textContent).toContain("$2.050,00")

    const botonVerComposicion = findClosestButtonByText(container, "Ver composicion")

    await act(async () => {
      botonVerComposicion.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(container.textContent).toContain("Hace click en cada componente para abrir la tab correspondiente.")
    expect(mockClienteAPI).toHaveBeenCalledTimes(1)
  })

  test("navega por drilldown externo y resuelve composicion interna sin fetch extra", async () => {
    const onDrilldown = jest.fn()
    await renderControlFondos({ onDrilldown })

    const botonPendiente = findClosestButtonByText(container, "Pendiente de acreditacion")
    const botonBancos = findClosestButtonByText(container, "En bancos")
    const botonDisponibleHoy = findClosestButtonByText(container, "Disponible hoy")

    await act(async () => {
      botonPendiente.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await act(async () => {
      botonBancos.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await act(async () => {
      botonDisponibleHoy.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(onDrilldown).toHaveBeenNthCalledWith(
      1,
      "pendiente_acreditacion",
      expect.objectContaining({
        tab: "cheques",
        vista_inicial: "historial",
        filtro_inicial: "DEPOSITADO",
      })
    )
    expect(onDrilldown).toHaveBeenNthCalledWith(
      2,
      "bancos",
      expect.objectContaining({
        tab: "bancos",
        vista_inicial: "listado",
      })
    )
    expect(container.textContent).toContain("Cada subtotal abre el detalle existente sin salir del modulo.")
    expect(mockClienteAPI).toHaveBeenCalledTimes(1)
  })
})
