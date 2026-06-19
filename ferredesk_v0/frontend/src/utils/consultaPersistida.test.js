import {
  guardarConsultaPersistida,
  leerConsultaPersistida,
  limpiarConsultaPersistida,
} from "./consultaPersistida"

describe("consultaPersistida", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("guarda y lee valores serializados", () => {
    const valor = {
      search: "martillo",
      pagina: 3,
      filtros: { activo: true },
    }

    guardarConsultaPersistida("productosConsultaPersistida", valor)

    expect(leerConsultaPersistida("productosConsultaPersistida", null)).toEqual(valor)
  })

  test("devuelve fallback si no existe valor o el json es invalido", () => {
    expect(leerConsultaPersistida("clave-inexistente", { vacio: true })).toEqual({ vacio: true })

    localStorage.setItem("clave-rota", "{json invalido")

    expect(leerConsultaPersistida("clave-rota", "fallback")).toBe("fallback")
  })

  test("elimina la clave persistida", () => {
    guardarConsultaPersistida("clientesConsultaPersistida", { pagina: 1 })

    limpiarConsultaPersistida("clientesConsultaPersistida")

    expect(localStorage.getItem("clientesConsultaPersistida")).toBeNull()
  })
})
