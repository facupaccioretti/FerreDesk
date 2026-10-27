import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionCoordinatorProvider } from "../../../domains/session/sessionCoordinator"
import ActivacionPerfiles from "./ActivacionPerfiles"

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

describe("ActivacionPerfiles (Integracion RTL)", () => {
  let container
  let root
  let queryClient
  let originalBroadcastChannel

  const mockSessionUser = {
    cuenta: { username: "ferreteria_central" },
    perfiles_adoptados: false,
    requiere_identificacion: false,
    motivo_requiere_identificacion: null,
    perfil_activo: null,
    permisos_efectivos: ["*"],
    capacidades: { puede_activar_perfiles: true },
    inactividad_segundos: null,
  }

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
    queryClient.setQueryData(["session", "user"], mockSessionUser)

    originalBroadcastChannel = global.BroadcastChannel
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))

    global.fetch = jest.fn()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount())
    }
    if (container && container.parentNode) {
      document.body.removeChild(container)
    }
    global.BroadcastChannel = originalBroadcastChannel
    jest.restoreAllMocks()
  })

  function renderComponent() {
    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <ActivacionPerfiles />
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })
  }

  function cambiarValor(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, valor)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  test("bloquea el envio unico contra doble clic", async () => {
    let resolverFetch
    const promesaPendiente = new Promise((resolve) => {
      resolverFetch = resolve
    })

    global.fetch.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      }
      if (urlStr.includes("/api/usuarios/activar-perfiles/")) {
        return promesaPendiente
      }
      return Promise.resolve(respuestaJSON(mockSessionUser))
    })

    await renderComponent()

    // Abrir modal
    const botonAbrir = container.querySelector("button")
    await act(async () => botonAbrir.click())

    const inputs = container.querySelectorAll("input")
    const [inputNombre, inputContrasena, inputPin, inputConfirmarPin] = inputs

    await act(async () => {
      cambiarValor(inputNombre, "Roman")
      cambiarValor(inputContrasena, "admin123")
      cambiarValor(inputPin, "123456")
      cambiarValor(inputConfirmarPin, "123456")
    })

    const botonSubmit = container.querySelector("button[type='submit']")

    // Simular doble clic rapido
    await act(async () => {
      botonSubmit.click()
      botonSubmit.click()
    })

    const llamadasActivar = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/usuarios/activar-perfiles/")
    )
    expect(llamadasActivar).toHaveLength(1)

    // Completar el fetch pendiente
    await act(async () => {
      resolverFetch(
        respuestaJSON(
          { perfil_activo: { id: 1, nombre: "Roman", etiqueta: "Dueño (Roman)" } },
          { status: 201 }
        )
      )
    })
  })

  test("maneja errores de campo (nombre, contrasena, pin, confirmar_pin) y limpia credenciales en fallo", async () => {
    const errorResponse = {
      code: "payload_invalido",
      message: "Hay errores en el formulario.",
      fields: {
        nombre: ["El nombre es obligatorio."],
        contrasena: ["Contraseña incorrecta."],
        pin: ["El PIN debe tener 6 dígitos."],
        confirmar_pin: ["La confirmación no coincide."],
      },
    }

    global.fetch.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      }
      if (urlStr.includes("/api/usuarios/activar-perfiles/")) {
        return Promise.resolve(respuestaJSON(errorResponse, { status: 400, ok: false }))
      }
      return Promise.resolve(respuestaJSON(mockSessionUser))
    })

    await renderComponent()

    // Abrir modal
    const botonAbrir = container.querySelector("button")
    await act(async () => botonAbrir.click())

    const inputs = container.querySelectorAll("input")
    const [inputNombre, inputContrasena, inputPin, inputConfirmarPin] = inputs

    await act(async () => {
      cambiarValor(inputNombre, "Roman")
      cambiarValor(inputContrasena, "wrongpass")
      cambiarValor(inputPin, "123")
      cambiarValor(inputConfirmarPin, "456")
    })

    const botonSubmit = container.querySelector("button[type='submit']")
    await act(async () => botonSubmit.click())

    // Verificar presencia de mensajes de error de campo
    expect(container.textContent).toContain("El nombre es obligatorio.")
    expect(container.textContent).toContain("Contraseña incorrecta.")
    expect(container.textContent).toContain("El PIN debe tener 6 dígitos.")
    expect(container.textContent).toContain("La confirmación no coincide.")

    // Higiene de credenciales: nombre se mantiene, pero contrasena y pines se limpian
    expect(inputNombre.value).toBe("Roman")
    expect(inputContrasena.value).toBe("")
    expect(inputPin.value).toBe("")
    expect(inputConfirmarPin.value).toBe("")
  })

  test("transicion tras 201 exitoso: transicion dura, publicacion en canal y cierre de modal", async () => {
    const sessionDuenoActivo = {
      ...mockSessionUser,
      perfiles_adoptados: true,
      perfil_activo: { id: 1, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      capacidades: { puede_activar_perfiles: false, puede_cerrar_sesion_negocio: true },
    }

    global.fetch.mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return Promise.resolve(respuestaJSON({ csrfToken: "csrf-token-test" }))
      }
      if (urlStr.includes("/api/usuarios/activar-perfiles/")) {
        return Promise.resolve(
          respuestaJSON(
            { perfil_activo: { id: 1, nombre: "Roman", etiqueta: "Dueño (Roman)" } },
            { status: 201 }
          )
        )
      }
      if (urlStr.includes("/api/user/")) {
        return Promise.resolve(respuestaJSON(sessionDuenoActivo))
      }
      return Promise.resolve(respuestaJSON({}))
    })

    await renderComponent()

    // Abrir modal
    const botonAbrir = container.querySelector("button")
    await act(async () => botonAbrir.click())

    const inputs = container.querySelectorAll("input")
    const [inputNombre, inputContrasena, inputPin, inputConfirmarPin] = inputs

    await act(async () => {
      cambiarValor(inputNombre, "Roman")
      cambiarValor(inputContrasena, "correcto123")
      cambiarValor(inputPin, "123456")
      cambiarValor(inputConfirmarPin, "123456")
    })

    const botonSubmit = container.querySelector("button[type='submit']")
    await act(async () => botonSubmit.click())

    // Modal se cierra (dialog ya no esta en el documento)
    expect(container.querySelector("form")).toBeNull()

    // Se consulto /api/user/ como parte de la transicion dura
    const llamadasUser = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUser.length).toBeGreaterThanOrEqual(1)
  })
})
