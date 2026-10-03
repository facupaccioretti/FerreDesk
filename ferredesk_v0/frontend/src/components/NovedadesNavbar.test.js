import {
  NOVEDAD_ACTUAL,
  claveNovedad,
  marcarNovedadVista,
  novedadFueVista,
} from "./NovedadesNavbar"

describe("NovedadesNavbar", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("guarda la lectura por usuario y version", () => {
    expect(novedadFueVista("lautaro")).toBe(false)

    marcarNovedadVista("lautaro")

    expect(window.localStorage.getItem(claveNovedad("lautaro"))).toBe(NOVEDAD_ACTUAL.id)
    expect(novedadFueVista("lautaro")).toBe(true)
    expect(novedadFueVista("otro-usuario")).toBe(false)
  })
})
