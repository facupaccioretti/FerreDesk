import React, { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { establecerPerfilEsperado, invalidarTokenCSRF } from "../../utils/clienteAPI"
import { deshabilitarStorageOperativo } from "./operationalStorage"
import {
  SessionCoordinatorProvider,
  useSessionCoordinator,
} from "./sessionCoordinator"
import { useInactivitySession } from "./useInactivitySession"

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

const mockUsuarioActivo = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: false,
  motivo_requiere_identificacion: null,
  perfil_activo: { id: 7, nombre: "Dueño", tipo: "DUENO", es_dueno: true },
  permisos_efectivos: ["ventas.ver"],
  capacidades: {},
  inactividad_segundos: 60,
}

const mockUsuarioExpirado = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: true,
  motivo_requiere_identificacion: "perfil_expirado_por_inactividad",
  perfil_activo: null,
  permisos_efectivos: [],
  capacidades: {},
  inactividad_segundos: 60,
}

async function flushPromises() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

describe("useInactivitySession (Comportamiento observable con fake timers y borde HTTP mockeado)", () => {
  let container
  let root
  let coordinatorRef
  let queryClient
  let triggerRerender

  function TestHarness() {
    coordinatorRef.current = useSessionCoordinator()
    useInactivitySession()
    const [contador, setContador] = useState(0)
    triggerRerender = () => setContador((c) => c + 1)

    return (
      <div>
        <div data-testid="contador-renders">{contador}</div>
        <div data-testid="estado-bloqueada">{String(coordinatorRef.current.bloqueada)}</div>
        <div data-testid="estado-requiere">{String(coordinatorRef.current.requiereReidentificacion)}</div>
      </div>
    )
  }

  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.clear()
    window.sessionStorage.clear()
    establecerPerfilEsperado(null)
    deshabilitarStorageOperativo()
    invalidarTokenCSRF()
    coordinatorRef = { current: null }

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
    deshabilitarStorageOperativo()
    establecerPerfilEsperado(null)
    jest.useRealTimers()
  })

  async function montarInactividad(usuarioInicial = mockUsuarioActivo) {
    global.fetch.mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return respuestaJSON({ csrfToken: "csrf-inactividad" })
      }
      if (urlStr.includes("/api/user/")) {
        return respuestaJSON({ status: "success", user: usuarioInicial })
      }
      return respuestaJSON({ ok: true })
    })

    queryClient.setQueryData(["session", "user"], usuarioInicial)

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
      await flushPromises()
    })

    // Limpiamos los mocks despues de la inicializacion para observar solo los efectos posteriores
    global.fetch.mockClear()
  }

  test("renders y polling de componentes no disparan heartbeat de actividad", async () => {
    await montarInactividad(mockUsuarioActivo)

    // Forzar multiples re-renders y pasaje de tiempo
    await act(async () => {
      triggerRerender()
      triggerRerender()
      triggerRerender()
      jest.advanceTimersByTime(30000)
      await flushPromises()
    })

    // Comprobar que no hubo ninguna llamada al endpoint de actividad
    const llamadasActividad = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/usuarios/perfiles/actividad/")
    )
    expect(llamadasActividad).toHaveLength(0)
  })

  test("aplica rate-limit de 1 heartbeat por minuto ante eventos humanos", async () => {
    await montarInactividad(mockUsuarioActivo)

    // Evento humano 1 a t=0: debe disparar heartbeat
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"))
      await flushPromises()
    })

    let llamadasActividad = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/usuarios/perfiles/actividad/")
    )
    expect(llamadasActividad).toHaveLength(1)
    expect(llamadasActividad[0][1].method).toBe("POST")

    // Eventos humanos repetidos dentro de los 60s siguientes (t=10s, 30s, 50s): no deben disparar
    await act(async () => {
      jest.advanceTimersByTime(10000)
      window.dispatchEvent(new Event("keydown"))
      await flushPromises()

      jest.advanceTimersByTime(20000)
      window.dispatchEvent(new Event("touchstart"))
      await flushPromises()

      jest.advanceTimersByTime(20000)
      window.dispatchEvent(new Event("pointerdown"))
      await flushPromises()
    })

    llamadasActividad = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/usuarios/perfiles/actividad/")
    )
    expect(llamadasActividad).toHaveLength(1)

    // Tras pasar la barrera de 60s (t=61s total), nuevo evento humano: debe disparar el segundo heartbeat
    await act(async () => {
      jest.advanceTimersByTime(11000) // t = 61000 ms
      window.dispatchEvent(new Event("pointerdown"))
      await flushPromises()
    })

    llamadasActividad = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/usuarios/perfiles/actividad/")
    )
    expect(llamadasActividad).toHaveLength(2)
  })

  test("al agotar inactividad_segundos consulta primero /api/user/ (si otra pestaña estuvo activa, no bloquea y reinicia timer)", async () => {
    await montarInactividad(mockUsuarioActivo)

    // Avance hasta 59 segundos: el timer local no ha vencido
    act(() => {
      jest.advanceTimersByTime(59000)
    })

    const llamadasUserAntes = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUserAntes).toHaveLength(0)

    // Servidor respondera que el perfil SIGUE ACTIVO (ej. actividad humana en otra pestaña)
    global.fetch.mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/user/")) {
        return respuestaJSON({ status: "success", user: mockUsuarioActivo })
      }
      return respuestaJSON({ ok: true })
    })

    // Vence el segundo 60
    await act(async () => {
      jest.advanceTimersByTime(1000)
      await flushPromises()
    })

    // Consulto /api/user/
    const llamadasUserDespues = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUserDespues).toHaveLength(1)

    // Como el servidor confirmo que sigue activo, la UI NO se bloquea y no requiere reidentificacion
    expect(coordinatorRef.current.bloqueada).toBe(false)
    expect(coordinatorRef.current.requiereReidentificacion).toBe(false)

    // Y el timer se reinicio: tras otros 59 segundos sigue sin consultar
    act(() => {
      jest.advanceTimersByTime(59000)
    })
    const llamadasUserSiguiente = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUserSiguiente).toHaveLength(1)
  })

  test("al agotar inactividad_segundos, si el servidor confirma expiracion, activa reidentificacion suave", async () => {
    await montarInactividad(mockUsuarioActivo)

    // Servidor responde que la sesion expiro por inactividad
    global.fetch.mockImplementation(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/user/")) {
        return respuestaJSON({ status: "success", user: mockUsuarioExpirado })
      }
      return respuestaJSON({ ok: true })
    })

    // Vence el timeout de 60 segundos
    await act(async () => {
      jest.advanceTimersByTime(60000)
      await flushPromises()
    })

    // Se consulto /api/user/
    const llamadasUser = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/user/")
    )
    expect(llamadasUser).toHaveLength(1)

    // El coordinador entra en bloqueo suave pidiendo PIN sin desmontar
    expect(coordinatorRef.current.bloqueada).toBe(true)
    expect(coordinatorRef.current.requiereReidentificacion).toBe(true)
    expect(coordinatorRef.current.sessionGeneration).toBe(0)
  })
})
