import React, { act, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  establecerPerfilEsperado,
  obtenerPerfilEsperado,
} from "../../utils/clienteAPI"
import {
  configurarAmbitoOperativo,
  deshabilitarStorageOperativo,
  limpiarEstadoOperativo,
  operationalLocalStorage,
} from "./operationalStorage"
import {
  SessionCoordinatorProvider,
  useSessionCoordinator,
} from "./sessionCoordinator"

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

const mockUsuarioPerfil1 = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: false,
  motivo_requiere_identificacion: null,
  perfil_activo: { id: 1, nombre: "Lautaro", tipo: "DUENO", es_dueno: true },
  permisos_efectivos: ["ventas.ver", "ventas.crear"],
  capacidades: { puede_gestionar_perfiles: true },
  inactividad_segundos: 900,
}

const mockUsuarioPerfil2 = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: false,
  motivo_requiere_identificacion: null,
  perfil_activo: { id: 2, nombre: "Romina", tipo: "ORDINARIO", es_dueno: false },
  permisos_efectivos: ["ventas.ver"],
  capacidades: { puede_gestionar_perfiles: false },
  inactividad_segundos: 900,
}

const mockUsuarioExpirado = {
  cuenta: { username: "ferreteria_central" },
  perfiles_adoptados: true,
  requiere_identificacion: true,
  motivo_requiere_identificacion: "perfil_expirado_por_inactividad",
  perfil_activo: null,
  permisos_efectivos: [],
  capacidades: {},
  inactividad_segundos: 900,
}

describe("sessionCoordinator (Comportamiento observable con React Query y borde HTTP mockeado)", () => {
  let container
  let root
  let coordinatorRef
  let queryClient
  let mountCount = 0

  function TestHarness({ children }) {
    coordinatorRef.current = useSessionCoordinator()
    const { sessionGeneration } = coordinatorRef.current

    return (
      <div>
        <div data-testid="session-gen">{sessionGeneration}</div>
        <FormularioSimulado key={sessionGeneration} />
        {children}
      </div>
    )
  }

  function FormularioSimulado() {
    useEffect(() => {
      mountCount += 1
    }, [])
    return <div data-testid="formulario-montado">Formulario Activo</div>
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.clear()
    window.sessionStorage.clear()
    establecerPerfilEsperado(null)
    deshabilitarStorageOperativo()
    mountCount = 0
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
  })

  async function montarCoordinador(usuarioInicial = mockUsuarioPerfil1) {
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
    })
  }

  test("inicializacion correcta: configura ambito operativo, perfil esperado y monta sin bloqueo", async () => {
    await montarCoordinador(mockUsuarioPerfil1)

    expect(coordinatorRef.current.bloqueada).toBe(false)
    expect(coordinatorRef.current.operationalReady).toBe(true)
    expect(coordinatorRef.current.sessionGeneration).toBe(0)
    expect(obtenerPerfilEsperado()).toBe("1")
    expect(mountCount).toBe(1)
  })

  test("transicion dura: limpia operationalStorage, limpia QueryClient, consulta /api/user/ y remonta arbol", async () => {
    await montarCoordinador(mockUsuarioPerfil1)

    // Simulamos trabajo en curso y cache
    operationalLocalStorage.setItem("clienteFormDraft_1", JSON.stringify({ nombre: "Cliente Borrador" }))
    queryClient.setQueryData(["clientes", "detalle", 1], { id: 1, saldo: 5000 })

    expect(operationalLocalStorage.getItem("clienteFormDraft_1")).toContain("Cliente Borrador")
    expect(queryClient.getQueryData(["clientes", "detalle", 1])).toBeDefined()

    // Servidor respondera con perfil 2 en transicion dura
    global.fetch.mockResolvedValueOnce(respuestaJSON({ status: "success", user: mockUsuarioPerfil2 }))

    await act(async () => {
      await coordinatorRef.current.transicionDura()
    })

    // 1. Storage operativo del perfil anterior fue limpiado
    expect(operationalLocalStorage.getItem("clienteFormDraft_1")).toBeNull()

    // 2. QueryClient fue limpiado (la query anterior desaparecio)
    expect(queryClient.getQueryData(["clientes", "detalle", 1])).toBeUndefined()

    // 3. sessionGeneration se incremento y remonto el formulario
    expect(coordinatorRef.current.sessionGeneration).toBe(1)
    expect(mountCount).toBe(2)

    // 4. Perfil esperado en memoria se actualizo a 2
    expect(obtenerPerfilEsperado()).toBe("2")
    expect(coordinatorRef.current.bloqueada).toBe(false)
    expect(coordinatorRef.current.operationalReady).toBe(true)
  })

  test("reidentificacion suave del mismo perfil: conserva borradores, cache y arbol montado", async () => {
    await montarCoordinador(mockUsuarioPerfil1)

    operationalLocalStorage.setItem("presupuestoFormDraft_99", JSON.stringify({ items: [1, 2] }))
    queryClient.setQueryData(["presupuestos", "borrador"], { items: [1, 2] })

    // Se notifica que expiro por inactividad
    act(() => {
      coordinatorRef.current.marcarReidentificacionSuave()
    })

    expect(coordinatorRef.current.bloqueada).toBe(true)
    expect(coordinatorRef.current.requiereReidentificacion).toBe(true)
    // El borrador NO se borra
    expect(operationalLocalStorage.getItem("presupuestoFormDraft_99")).toContain("items")
    // El arbol NO se ha remontado
    expect(mountCount).toBe(1)
    expect(coordinatorRef.current.sessionGeneration).toBe(0)

    // El usuario se reidentifica con exito con el MISMO perfil 1
    global.fetch.mockResolvedValueOnce(respuestaJSON({ status: "success", user: mockUsuarioPerfil1 }))

    await act(async () => {
      await coordinatorRef.current.reidentificacionSuave(1)
    })

    // La UI se desbloquea
    expect(coordinatorRef.current.bloqueada).toBe(false)
    expect(coordinatorRef.current.requiereReidentificacion).toBe(false)
    // sessionGeneration NO cambio: no hubo remontaje destructor
    expect(coordinatorRef.current.sessionGeneration).toBe(0)
    expect(mountCount).toBe(1)
    // El borrador sigue completamente intacto
    expect(operationalLocalStorage.getItem("presupuestoFormDraft_99")).toContain("items")
    expect(obtenerPerfilEsperado()).toBe("1")
  })

  test("conversion a transicion dura si en el overlay se elige un perfil distinto tras inactividad", async () => {
    await montarCoordinador(mockUsuarioPerfil1)

    // Borrador asociado al perfil 1
    operationalLocalStorage.setItem("stockFormDraft_10", JSON.stringify({ codigo: "PALA-01" }))
    queryClient.setQueryData(["productos", 10], { codigo: "PALA-01" })

    // Se entra en reidentificacion suave para el perfil 1
    act(() => {
      coordinatorRef.current.marcarReidentificacionSuave()
    })

    expect(coordinatorRef.current.requiereReidentificacion).toBe(true)

    // En el selector del overlay, se identifica en cambio el perfil 2!
    global.fetch.mockResolvedValueOnce(respuestaJSON({ status: "success", user: mockUsuarioPerfil2 }))

    await act(async () => {
      // perfilAnteriorId era 1, pero remoto devolvio perfil 2
      await coordinatorRef.current.reidentificacionSuave(1)
    })

    // Se convirtio en transicion dura:
    // 1. Limpio el almacenamiento operativo del perfil 1
    expect(operationalLocalStorage.getItem("stockFormDraft_10")).toBeNull()
    // 2. Limpio la cache de React Query
    expect(queryClient.getQueryData(["productos", 10])).toBeUndefined()
    // 3. Incremento sessionGeneration para forzar remonte de componentes
    expect(coordinatorRef.current.sessionGeneration).toBe(1)
    expect(mountCount).toBe(2)
    // 4. Actualizo perfil esperado al nuevo perfil 2
    expect(obtenerPerfilEsperado()).toBe("2")
    expect(coordinatorRef.current.bloqueada).toBe(false)
  })

  test("revalidarSesion: si el servidor reporta inactividad confirmada, activa overlay suave sin desmontar", async () => {
    await montarCoordinador(mockUsuarioPerfil1)

    operationalLocalStorage.setItem("clienteFormDraft_1", "borrador-activo")

    // Al revalidar, el servidor responde requiere_identificacion por inactividad
    global.fetch.mockResolvedValueOnce(respuestaJSON({ status: "success", user: mockUsuarioExpirado }))

    await act(async () => {
      await coordinatorRef.current.revalidarSesion()
    })

    expect(coordinatorRef.current.bloqueada).toBe(true)
    expect(coordinatorRef.current.requiereReidentificacion).toBe(true)
    // sessionGeneration no cambia (no desmonta)
    expect(coordinatorRef.current.sessionGeneration).toBe(0)
    expect(operationalLocalStorage.getItem("clienteFormDraft_1")).toBe("borrador-activo")
  })
})
