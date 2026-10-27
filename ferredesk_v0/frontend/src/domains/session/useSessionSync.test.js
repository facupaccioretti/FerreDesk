import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionCoordinatorProvider, useSessionCoordinator } from "./sessionCoordinator"
import { publicarRevalidacionSesion, restablecerCanalSesionSync, useSessionSync } from "./useSessionSync"
import { establecerPerfilEsperado } from "../../utils/clienteAPI"
import { deshabilitarStorageOperativo, operationalLocalStorage } from "./operationalStorage"

function respuestaJSON(body, opciones = {}) {
  return {
    ok: opciones.ok ?? true,
    status: opciones.status ?? 200,
    statusText: opciones.statusText ?? "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const mockUsuario = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: false,
  motivo_requiere_identificacion: null,
  perfil_activo: { id: 1, nombre: "Dueño", tipo: "DUENO", es_dueno: true },
  permisos_efectivos: ["ventas.ver"],
  capacidades: {},
  inactividad_segundos: 900,
}

describe("useSessionSync y BroadcastChannel", () => {
  let channelListeners = []
  let postMessageMock
  let originalBroadcastChannel
  let container
  let root
  let coordinatorRef
  let queryClient

  function TestHarness() {
    coordinatorRef.current = useSessionCoordinator()
    useSessionSync()
    return <div data-testid="sync-harness">Sync Active</div>
  }

  beforeEach(() => {
    restablecerCanalSesionSync()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    channelListeners = []
    postMessageMock = jest.fn()
    window.localStorage.clear()
    establecerPerfilEsperado(null)
    deshabilitarStorageOperativo()
    coordinatorRef = { current: null }

    originalBroadcastChannel = global.BroadcastChannel
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn((event, callback) => {
        if (event === "message") channelListeners.push(callback)
      }),
      removeEventListener: jest.fn((event, callback) => {
        if (event === "message") {
          channelListeners = channelListeners.filter((cb) => cb !== callback)
        }
      }),
      postMessage: postMessageMock,
    }))

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    })
    global.fetch = jest.fn()
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    if (container && container.parentNode) {
      document.body.removeChild(container)
    }
    restablecerCanalSesionSync()
    global.BroadcastChannel = originalBroadcastChannel
    deshabilitarStorageOperativo()
    establecerPerfilEsperado(null)
  })

  test("publicarRevalidacionSesion emite estrictamente { type: 'revalidate-session' } sin identidad ni secretos", () => {
    publicarRevalidacionSesion()

    expect(global.BroadcastChannel).toHaveBeenCalledWith("ferredesk-session")
    expect(postMessageMock).toHaveBeenCalledTimes(1)
    expect(postMessageMock).toHaveBeenCalledWith({ type: "revalidate-session" })

    const payload = postMessageMock.mock.calls[0][0]
    expect(payload).toEqual({ type: "revalidate-session" })
    expect(payload.perfil).toBeUndefined()
    expect(payload.token).toBeUndefined()
    expect(payload.pin).toBeUndefined()
    expect(payload.permisos).toBeUndefined()
  })

  test("recepcion de aviso por BroadcastChannel bloquea UI, limpia storage y ejecuta transicion dura", async () => {
    queryClient.setQueryData(["session", "user"], mockUsuario)
    global.fetch.mockResolvedValue(respuestaJSON({ status: "success", user: mockUsuario }))

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <TestHarness />
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })

    operationalLocalStorage.setItem("clienteFormDraft_1", "datos-sensibles")
    queryClient.setQueryData(["clientes", "lista"], [{ id: 1 }])

    // Se simula la llegada del mensaje desde otra pestaña
    expect(channelListeners.length).toBeGreaterThan(0)

    await act(async () => {
      for (const listener of channelListeners) {
        listener({ data: { type: "revalidate-session" } })
      }
      await Promise.resolve()
    })

    // La segunda pestaña limpia el storage operativo y la cache de react-query
    expect(operationalLocalStorage.getItem("clienteFormDraft_1")).toBeNull()
    expect(queryClient.getQueryData(["clientes", "lista"])).toBeUndefined()
    expect(coordinatorRef.current.sessionGeneration).toBe(1)
  })

  test("evento focus en la ventana dispara revalidacion con el servidor", async () => {
    queryClient.setQueryData(["session", "user"], mockUsuario)
    global.fetch.mockResolvedValue(respuestaJSON({ status: "success", user: mockUsuario }))

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <TestHarness />
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })

    global.fetch.mockClear()
    global.fetch.mockResolvedValueOnce(respuestaJSON({ status: "success", user: mockUsuario }))

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
    })

    const llamadasUser = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUser.length).toBeGreaterThanOrEqual(1)
  })

  test("no existe listener ni fallback por evento 'storage' en window", () => {
    const addEventListenerSpy = jest.spyOn(window, "addEventListener")

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <TestHarness />
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })

    const llamadasStorage = addEventListenerSpy.mock.calls.filter(([evento]) => evento === "storage")
    expect(llamadasStorage).toHaveLength(0)

    addEventListenerSpy.mockRestore()
  })
})
