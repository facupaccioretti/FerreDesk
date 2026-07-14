jest.mock("./herramientasforms/ComprobanteAsociadoTooltip", () => () => null)
jest.mock("./herramientasforms/TooltipFacturado", () => () => null)
jest.mock("./herramientasforms/plantillasComprobantes/helpers", () => ({
  formatearMoneda: (valor) => valor,
}))

import { esElegibleParaPostventa } from "./elegibilidadPostventa"
import { BotonPostventa } from "../Botones"
import { generarBotonesComprobante } from "./ComprobantesList"

describe("esElegibleParaPostventa", () => {
  const cotizacionCerrada = {
    comprobante: { tipo: "factura_interna" },
    estado: "Cerrado",
    convertida_a_fiscal: false,
  }

  it("habilita solo la cotizacion interna cerrada sin convertir", () => {
    expect(esElegibleParaPostventa(cotizacionCerrada)).toBe(true)
  })

  it.each([
    [{ ...cotizacionCerrada, estado: "Abierto" }],
    [{ ...cotizacionCerrada, convertida_a_fiscal: true }],
    [{ ...cotizacionCerrada, comprobante: { tipo: "factura" } }],
    [{ ...cotizacionCerrada, comprobante: { tipo: "venta" } }],
    [{ ...cotizacionCerrada, comprobante: { tipo: "presupuesto" } }],
  ])("oculta la accion fuera del contrato", (comprobante) => {
    expect(esElegibleParaPostventa(comprobante)).toBe(false)
  })
})

describe("generarBotonesComprobante", () => {
  const acciones = {
    handleImprimir: jest.fn(),
    openVistaTab: jest.fn(),
    handleEdit: jest.fn(),
    handleConvertir: jest.fn(),
    handleDelete: jest.fn(),
    handleConvertirFacturaI: jest.fn(),
    handleNotaCredito: jest.fn(),
    handlePostventa: jest.fn(),
  }
  const cotizacionCerrada = {
    id: 8,
    comprobante: { tipo: "factura_interna", letra: "I" },
    estado: "Cerrado",
    convertida_a_fiscal: false,
  }

  beforeEach(() => jest.clearAllMocks())

  it("incluye y ejecuta la accion solo para el contrato interno", () => {
    const botones = generarBotonesComprobante(cotizacionCerrada, acciones, false, null, () => false)
    const postventa = botones.find(({ componente }) => componente === BotonPostventa)

    expect(postventa).toBeDefined()
    postventa.onClick()
    expect(acciones.handlePostventa).toHaveBeenCalledWith(cotizacionCerrada)
  })

  it.each([
    { ...cotizacionCerrada, convertida_a_fiscal: true },
    { ...cotizacionCerrada, comprobante: { tipo: "factura", letra: "A" } },
    { ...cotizacionCerrada, estado: "Abierto" },
  ])("no incluye la accion fuera del contrato", (comprobante) => {
    const botones = generarBotonesComprobante(comprobante, acciones, false, null, () => false)

    expect(botones.some(({ componente }) => componente === BotonPostventa)).toBe(false)
  })
})
