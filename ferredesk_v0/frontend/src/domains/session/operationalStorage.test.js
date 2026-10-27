import {
  configurarAmbitoOperativo,
  deshabilitarStorageOperativo,
  limpiarEstadoOperativo,
  operationalLocalStorage,
  operationalSessionStorage,
} from "./operationalStorage"

describe("operationalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    configurarAmbitoOperativo({ tenant: "demo.localhost", perfilId: 1 })
  })

  afterEach(() => deshabilitarStorageOperativo())

  test("migra una clave legacy al ambito validado y aisla perfiles", () => {
    window.localStorage.setItem("clientesTabs", "perfil-1")

    expect(operationalLocalStorage.getItem("clientesTabs")).toBe("perfil-1")
    expect(window.localStorage.getItem("clientesTabs")).toBeNull()

    configurarAmbitoOperativo({ tenant: "demo.localhost", perfilId: 2 })
    expect(operationalLocalStorage.getItem("clientesTabs")).toBeNull()
    operationalLocalStorage.setItem("clientesTabs", "perfil-2")

    configurarAmbitoOperativo({ tenant: "demo.localhost", perfilId: 1 })
    expect(operationalLocalStorage.getItem("clientesTabs")).toBe("perfil-1")
  })

  test("limpia solo el ambito activo y las claves legacy registradas", () => {
    operationalLocalStorage.setItem("productosTabs", "uno")
    operationalSessionStorage.setItem("postventa:idempotency:42", "uuid")
    window.localStorage.setItem("ferredesk_novedad_user", "2026-10")

    limpiarEstadoOperativo()

    expect(operationalLocalStorage.getItem("productosTabs")).toBeNull()
    expect(operationalSessionStorage.getItem("postventa:idempotency:42")).toBeNull()
    expect(window.localStorage.getItem("ferredesk_novedad_user")).toBe("2026-10")
  })

  test("no lee ni escribe antes de configurar un ambito", () => {
    deshabilitarStorageOperativo()
    window.localStorage.setItem("clientesTabs", "legacy")

    expect(operationalLocalStorage.getItem("clientesTabs")).toBeNull()
    expect(operationalLocalStorage.setItem("clientesTabs", "nuevo")).toBe(false)
    expect(window.localStorage.getItem("clientesTabs")).toBe("legacy")
  })
})
