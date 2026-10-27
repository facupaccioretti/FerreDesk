import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionCoordinatorProvider } from "../../../domains/session/sessionCoordinator"
import SelectorPerfil from "./SelectorPerfil"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function respuestaJSON(body, opciones = {}) {
  return {
    ok: opciones.ok ?? true,
    status: opciones.status ?? 200,
    statusText: opciones.statusText ?? "OK",
    headers: new Headers({
      "content-type": "application/json",
      ...(opciones.headers || {}),
    }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const mockPerfilesSeleccion = [
  { id: 1, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true, espera_hasta: null },
  { id: 2, nombre: "María", etiqueta: "María", tipo: "ORDINARIO", es_dueno: false, espera_hasta: null },
]

describe("SelectorPerfil (Integracion RTL)", () => {
  let container
  let root
  let queryClient

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(["usuarios", "seleccion"], mockPerfilesSeleccion)

    global.fetch = jest.fn((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      }
      if (urlStr.includes("/api/usuarios/perfiles/seleccion/")) {
        return Promise.resolve(respuestaJSON(mockPerfilesSeleccion))
      }
      if (urlStr.includes("/api/user/")) {
        return Promise.resolve(respuestaJSON({ cuenta: { username: "ferreteria" } }))
      }
      return Promise.resolve(respuestaJSON({}))
    })
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount())
    }
    if (container && container.parentNode) {
      document.body.removeChild(container)
    }
    jest.restoreAllMocks()
  })

  function renderSelector({ modo = "identificar", perfilAnteriorId = null, motivo = null, onCancel = null } = {}) {
    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <SelectorPerfil
              modo={modo}
              perfilAnteriorId={perfilAnteriorId}
              motivo={motivo}
              onCancel={onCancel}
            />
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })
  }

  function boton(ariaLabel) {
    return container.querySelector(`button[aria-label="${ariaLabel}"]`)
  }

  function cambiarValor(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, valor)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  test("renderiza lista de perfiles y permite seleccion por clic", async () => {
    await renderSelector()

    expect(container.textContent).toContain("Dueño (Roman)")
    expect(container.textContent).toContain("María")
    expect(container.textContent).toContain("Elegi un perfil para ingresar el PIN.")

    // Seleccionar perfil Roman
    const botonRoman = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Dueño (Roman)")
    )
    await act(async () => botonRoman.click())

    // PinPad aparece con su input y teclado numerico
    expect(container.querySelector("#perfil-pin")).not.toBeNull()
    expect(boton("Confirmar PIN")).not.toBeNull()
  })

  test("ingreso por teclado fisico y por botones virtuales en PinPad", async () => {
    await renderSelector({ perfilAnteriorId: 1 })

    const inputPin = container.querySelector("#perfil-pin")
    expect(inputPin).not.toBeNull()

    // 1. Ingreso por teclado fisico: escribir 123
    await act(async () => {
      cambiarValor(inputPin, "123")
    })
    expect(inputPin.value).toBe("123")

    // 2. Ingreso por botones virtuales: presionar 4, 5, 6
    await act(async () => {
      boton("Ingresar 4").click()
      boton("Ingresar 5").click()
      boton("Ingresar 6").click()
    })
    expect(inputPin.value).toBe("123456")
  })

  test("limpieza del PIN tras 403 identificacion_fallida", async () => {
    const errorIdentificacion = {
      code: "identificacion_fallida",
      message: "PIN incorrecto.",
    }

    global.fetch.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      if (urlStr.includes("/api/usuarios/perfiles/seleccion/")) return Promise.resolve(respuestaJSON(mockPerfilesSeleccion))
      if (urlStr.includes("/api/usuarios/perfiles/identificar/")) {
        return Promise.resolve(respuestaJSON(errorIdentificacion, { status: 403, ok: false }))
      }
      return Promise.resolve(respuestaJSON({}))
    })

    await renderSelector({ perfilAnteriorId: 1 })

    const inputPin = container.querySelector("#perfil-pin")
    await act(async () => cambiarValor(inputPin, "999999"))

    await act(async () => boton("Confirmar PIN").click())

    // Error visible
    expect(container.textContent).toContain("PIN incorrecto.")
    // PIN limpiado
    expect(inputPin.value).toBe("")
  })

  test("bloqueo con cuenta regresiva ante 429 pin_espera_activa (Retry-After)", async () => {
    const errorEspera = {
      code: "pin_espera_activa",
      message: "Demasiados intentos fallidos.",
    }

    global.fetch.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      if (urlStr.includes("/api/usuarios/perfiles/seleccion/")) return Promise.resolve(respuestaJSON(mockPerfilesSeleccion))
      if (urlStr.includes("/api/usuarios/perfiles/identificar/")) {
        return Promise.resolve(
          respuestaJSON(errorEspera, {
            status: 429,
            ok: false,
            headers: { "Retry-After": "45" },
          })
        )
      }
      return Promise.resolve(respuestaJSON({}))
    })

    await renderSelector({ perfilAnteriorId: 1 })

    const inputPin = container.querySelector("#perfil-pin")
    await act(async () => cambiarValor(inputPin, "123456"))

    await act(async () => boton("Confirmar PIN").click())

    // PIN limpiado y cuenta regresiva activa
    expect(inputPin.value).toBe("")
    expect(container.textContent).toContain("Espera 45 s para volver a intentar.")
    expect(boton("Confirmar PIN").disabled).toBe(true)
  })

  test("cambio de seleccion de perfil limpia el PIN del PinPad", async () => {
    await renderSelector({ perfilAnteriorId: 1 })

    const inputPin = container.querySelector("#perfil-pin")
    await act(async () => cambiarValor(inputPin, "123"))
    expect(inputPin.value).toBe("123")

    // Cambiar seleccion a Maria (id: 2)
    const botonMaria = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("María")
    )
    await act(async () => botonMaria.click())

    const nuevoInputPin = container.querySelector("#perfil-pin")
    expect(nuevoInputPin.value).toBe("")
  })

  test("tras inactividad utiliza POST identificar/ y no muestra boton Cancelar", async () => {
    let endpointLlamado = null
    let bodyEnviado = null

    global.fetch.mockImplementation((url, opts) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      if (urlStr.includes("/api/usuarios/perfiles/seleccion/")) return Promise.resolve(respuestaJSON(mockPerfilesSeleccion))
      if (urlStr.includes("/api/usuarios/perfiles/identificar/")) {
        endpointLlamado = "identificar"
        bodyEnviado = JSON.parse(opts.body)
        return Promise.resolve(respuestaJSON({ perfil_activo: { id: 1, etiqueta: "Dueño (Roman)" } }))
      }
      if (urlStr.includes("/api/usuarios/perfiles/cambiar/")) {
        endpointLlamado = "cambiar"
        return Promise.resolve(respuestaJSON({ perfil_activo: { id: 1, etiqueta: "Dueño (Roman)" } }))
      }
      if (urlStr.includes("/api/user/")) {
        return Promise.resolve(
          respuestaJSON({
            cuenta: { username: "ferreteria" },
            perfil_activo: { id: 1, etiqueta: "Dueño (Roman)" },
            perfiles_adoptados: true,
            requiere_identificacion: false,
          })
        )
      }
      return Promise.resolve(respuestaJSON({}))
    })

    await renderSelector({
      modo: "identificar",
      perfilAnteriorId: 1,
      motivo: "perfil_expirado_por_inactividad",
    })

    // Mensaje de inactividad
    expect(container.textContent).toContain("La identificacion vencio por inactividad.")

    // No hay boton cancelar
    const botonCancelar = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.trim() === "Cancelar"
    )
    expect(botonCancelar).toBeUndefined()

    // Enviar PIN
    const inputPin = container.querySelector("#perfil-pin")
    await act(async () => cambiarValor(inputPin, "123456"))
    await act(async () => boton("Confirmar PIN").click())

    // Exige llamar a identificar/, no a cambiar/
    expect(endpointLlamado).toBe("identificar")
    expect(bodyEnviado).toEqual({ perfil_id: 1, pin: "123456" })
  })

  test("con sesion vigente utiliza POST cambiar/ y expone boton Cancelar", async () => {
    let endpointLlamado = null
    let bodyEnviado = null
    const onCancelMock = jest.fn()

    global.fetch.mockImplementation((url, opts) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      if (urlStr.includes("/api/usuarios/perfiles/seleccion/")) return Promise.resolve(respuestaJSON(mockPerfilesSeleccion))
      if (urlStr.includes("/api/usuarios/perfiles/cambiar/")) {
        endpointLlamado = "cambiar"
        bodyEnviado = JSON.parse(opts.body)
        return Promise.resolve(respuestaJSON({ perfil_activo: { id: 2, etiqueta: "María" } }))
      }
      if (urlStr.includes("/api/user/")) {
        return Promise.resolve(
          respuestaJSON({
            cuenta: { username: "ferreteria" },
            perfil_activo: { id: 2, etiqueta: "María" },
            perfiles_adoptados: true,
            requiere_identificacion: false,
          })
        )
      }
      return Promise.resolve(respuestaJSON({}))
    })

    await renderSelector({
      modo: "cambiar",
      perfilAnteriorId: 1,
      onCancel: onCancelMock,
    })

    expect(container.textContent).toContain("Cambiar perfil")

    // Boton Cancelar esta presente y dispara onCancel
    const botonCancelar = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.trim() === "Cancelar"
    )
    expect(botonCancelar).toBeDefined()
    await act(async () => botonCancelar.click())
    expect(onCancelMock).toHaveBeenCalled()

    // Seleccionar a Maria (id: 2) y enviar PIN
    const botonMaria = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("María")
    )
    await act(async () => botonMaria.click())

    const inputPin = container.querySelector("#perfil-pin")
    await act(async () => cambiarValor(inputPin, "654321"))
    await act(async () => boton("Confirmar PIN").click())

    // Llama a cambiar/, no a identificar/
    expect(endpointLlamado).toBe("cambiar")
    expect(bodyEnviado).toEqual({ perfil_id: 2, pin: "654321" })
  })
})
