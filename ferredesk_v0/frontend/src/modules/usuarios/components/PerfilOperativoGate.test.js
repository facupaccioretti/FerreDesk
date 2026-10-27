import React, { act, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionCoordinatorProvider, useSessionCoordinator } from "../../../domains/session/sessionCoordinator"
import PerfilOperativoGate from "./PerfilOperativoGate"
import RutaPrivada from "../../../components/RutaPrivada"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let mockPathname = "/home/ventas"
const mockNavigate = jest.fn()

jest.mock(
  "react-router-dom",
  () => ({
    Navigate: ({ to }) => <div data-testid="navigate-redirect">redirigido:{to}</div>,
    useLocation: () => ({ pathname: mockPathname }),
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
)

jest.mock("../../../domains/setup/useSetupStatusQuery", () => ({
  useSetupStatusQuery: () => ({
    isLoading: false,
    setupCompleto: true,
  }),
}))

describe("PerfilOperativoGate y RutaPrivada — 6 Estados de la Máquina (Integracion RTL)", () => {
  let container
  let root
  let queryClient
  let managerMountCount = 0
  let managerEffectDispatched = 0

  function DummyManager() {
    useEffect(() => {
      managerMountCount++
      managerEffectDispatched++
    }, [])
    return <div data-testid="dummy-manager">Manager ERP Protegido</div>
  }

  let usuarioActual = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    managerMountCount = 0
    managerEffectDispatched = 0
    mockNavigate.mockReset()
    usuarioActual = null

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    })

    global.fetch = jest.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/csrf/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ csrfToken: "csrf-test" }),
          text: async () => JSON.stringify({ csrfToken: "csrf-test" }),
        })
      }
      if (urlStr.includes("/api/user/")) {
        if (!usuarioActual) {
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ code: "cuenta_no_autenticada" }),
            text: async () => JSON.stringify({ code: "cuenta_no_autenticada" }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ status: "success", user: usuarioActual }),
          text: async () => JSON.stringify({ status: "success", user: usuarioActual }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
        text: async () => "{}",
      })
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

  function renderTree({ user, permisoRequerido = null } = {}) {
    usuarioActual = user
    if (user !== undefined) {
      queryClient.setQueryData(["session", "user"], user)
    }

    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <PerfilOperativoGate>
              <RutaPrivada
                hostnameActual="demo.localhost"
                permiso={permisoRequerido}
              >
                <DummyManager />
              </RutaPrivada>
            </PerfilOperativoGate>
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })
  }

  // =========================================================================
  // ESTADO 1: Cuenta no autenticada
  // =========================================================================
  test("Estado 1: Cuenta no autenticada — no monta el Manager del ERP y redirige a login", async () => {
    await renderTree({ user: null, permisoRequerido: "ventas.ver" })

    expect(container.querySelector("[data-testid='dummy-manager']")).toBeNull()
    expect(managerMountCount).toBe(0)
    expect(managerEffectDispatched).toBe(0)
  })

  // =========================================================================
  // ESTADO 2: Cuenta autenticada sin adopción (TITULAR)
  // =========================================================================
  test("Estado 2: Cuenta autenticada sin adopción — monta Manager como TITULAR y expone llamada a activar si tiene capacidad", async () => {
    const userSinAdopcion = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: false,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: null,
      permisos_efectivos: ["ventas.ver"],
      capacidades: { puede_activar_perfiles: true, puede_cerrar_sesion_negocio: true },
      inactividad_segundos: null,
    }

    await renderTree({ user: userSinAdopcion, permisoRequerido: "ventas.ver" })

    // Monta el Manager protegido
    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()
    expect(managerMountCount).toBe(1)

    // Muestra llamada voluntaria a activar perfiles
    expect(container.textContent).toContain("Activar perfiles")
  })

  test("Estado 2b: Cuenta autenticada sin adopción pero sin capacidad — no ofrece activación de perfiles", async () => {
    const userSinCapacidad = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: false,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: null,
      permisos_efectivos: ["ventas.ver"],
      capacidades: { puede_activar_perfiles: false, puede_cerrar_sesion_negocio: true },
      inactividad_segundos: null,
    }

    await renderTree({ user: userSinCapacidad, permisoRequerido: "ventas.ver" })

    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()
    expect(container.textContent).not.toContain("Activar perfiles")
  })

  // =========================================================================
  // ESTADO 3: Perfiles adoptados sin identificación
  // =========================================================================
  test("Estado 3: Perfiles adoptados sin identificación — PerfilOperativoGate NO monta el Manager protegido", async () => {
    const userRequiereIdentificacion = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: true,
      motivo_requiere_identificacion: "perfil_requerido",
      perfil_activo: null,
      permisos_efectivos: [],
      capacidades: {},
      inactividad_segundos: 900,
    }

    await renderTree({ user: userRequiereIdentificacion, permisoRequerido: "ventas.ver" })

    // El Manager JAMAS se monta, no ejecuta useEffect ni dispara llamadas API
    expect(container.querySelector("[data-testid='dummy-manager']")).toBeNull()
    expect(managerMountCount).toBe(0)
    expect(managerEffectDispatched).toBe(0)
  })

  // =========================================================================
  // ESTADO 4: Perfil identificado — evaluación de permisos en RutaPrivada
  // =========================================================================
  test("Estado 4: Perfil identificado — monta Manager protegido si tiene permiso", async () => {
    const userIdentificado = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: { id: 7, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      permisos_efectivos: ["ventas.ver", "ventas.crear"],
      capacidades: { puede_gestionar_perfiles: true, puede_cerrar_sesion_negocio: true },
      inactividad_segundos: 900,
    }

    await renderTree({ user: userIdentificado, permisoRequerido: "ventas.ver" })

    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()
    expect(managerMountCount).toBe(1)
  })

  test("Estado 4b: Perfil identificado sin permiso — RutaPrivada NO monta el Manager protegido y muestra 'No tenes acceso'", async () => {
    const userSinPermiso = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: { id: 9, nombre: "María", etiqueta: "María", tipo: "ORDINARIO", es_dueno: false },
      permisos_efectivos: ["clientes.ver"],
      capacidades: { puede_gestionar_perfiles: false, puede_cerrar_sesion_negocio: false },
      inactividad_segundos: 900,
    }

    await renderTree({ user: userSinPermiso, permisoRequerido: "caja.ver" })

    // Manager protegido NO se monta
    expect(container.querySelector("[data-testid='dummy-manager']")).toBeNull()
    expect(managerMountCount).toBe(0)
    expect(managerEffectDispatched).toBe(0)

    // Muestra pantalla informativa de acceso restringido
    expect(container.textContent).toContain("No tenes acceso")
    expect(container.textContent).toContain("Tu perfil no tiene permiso para abrir este modulo.")
  })

  // =========================================================================
  // ESTADO 5: Expiración de identificación por inactividad
  // =========================================================================
  test("Estado 5: Expiración por inactividad en sesión activa — mantiene el Manager protegido montado", async () => {
    const userActivo = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: { id: 7, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      permisos_efectivos: ["ventas.ver"],
      capacidades: { puede_gestionar_perfiles: true },
      inactividad_segundos: 900,
    }

    let coordinatorHandle
    function CoordinatorInterceptor() {
      coordinatorHandle = useSessionCoordinator()
      return null
    }

    queryClient.setQueryData(["session", "user"], userActivo)
    usuarioActual = userActivo

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <CoordinatorInterceptor />
            <PerfilOperativoGate>
              <RutaPrivada hostnameActual="demo.localhost" permiso="ventas.ver">
                <DummyManager />
              </RutaPrivada>
            </PerfilOperativoGate>
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })

    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()
    expect(managerMountCount).toBe(1)

    // Simular que el servidor confirma expiracion por inactividad
    await act(async () => {
      coordinatorHandle.marcarReidentificacionSuave(7, "perfil_expirado_por_inactividad")
    })

    // El Manager protegido sigue montado debajo del overlay
    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()
    // No se volvio a montar desde cero (no incremento el contador de mount)
    expect(managerMountCount).toBe(1)
  })

  // =========================================================================
  // ESTADO 6: Sesión o credencial invalidada
  // =========================================================================
  test("Estado 6: Sesión/credencial invalidada — transición dura desmonta el contenido protegido", async () => {
    const userActivo = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: false,
      motivo_requiere_identificacion: null,
      perfil_activo: { id: 7, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      permisos_efectivos: ["ventas.ver"],
      capacidades: { puede_gestionar_perfiles: true },
      inactividad_segundos: 900,
    }

    const userInvalido = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      requiere_identificacion: true,
      motivo_requiere_identificacion: "perfil_invalido",
      perfil_activo: null,
      permisos_efectivos: [],
      capacidades: {},
      inactividad_segundos: 900,
    }

    let coordinatorHandle
    function CoordinatorInterceptor() {
      coordinatorHandle = useSessionCoordinator()
      return null
    }

    usuarioActual = userActivo
    queryClient.setQueryData(["session", "user"], userActivo)

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionCoordinatorProvider>
            <CoordinatorInterceptor />
            <PerfilOperativoGate>
              <RutaPrivada hostnameActual="demo.localhost" permiso="ventas.ver">
                <DummyManager />
              </RutaPrivada>
            </PerfilOperativoGate>
          </SessionCoordinatorProvider>
        </QueryClientProvider>
      )
    })

    expect(container.querySelector("[data-testid='dummy-manager']")).not.toBeNull()

    // El backend ahora respondera que la sesion o credencial fue invalidada
    usuarioActual = userInvalido

    // Disparar transicion dura por credencial invalidada
    await act(async () => {
      await coordinatorHandle.transicionDura()
    })

    // Al quedar en requiere_identificacion con perfil_activo=null, el Manager queda desmontado
    expect(container.querySelector("[data-testid='dummy-manager']")).toBeNull()
  })
})
