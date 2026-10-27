import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppShellProvider } from "../contexts/AppShellContext"
import Navbar from "./Navbar"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockNavigate = jest.fn()
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
)

jest.mock("./NovedadesNavbar", () => () => <div data-testid="novedades-navbar" />)

describe("Navbar (Integracion RTL)", () => {
  let container
  let root
  let queryClient

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    mockNavigate.mockReset()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
      },
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

  function renderNavbar({
    user,
    onBloquearPerfil = jest.fn(),
    onCambiarPerfil = jest.fn(),
    onCambiarPin = jest.fn(),
    onLogout = jest.fn(),
  } = {}) {
    queryClient.setQueryData(["session", "user"], user)

    return act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AppShellProvider value={{ hasGlobalNavbar: false }}>
            <Navbar
              user={user}
              onBloquearPerfil={onBloquearPerfil}
              onCambiarPerfil={onCambiarPerfil}
              onCambiarPin={onCambiarPin}
              onLogout={onLogout}
              forceRender
            />
          </AppShellProvider>
        </QueryClientProvider>
      )
    })
  }

  test("muestra perfil_activo.etiqueta y username secundario de la cuenta", async () => {
    const userDueno = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      perfil_activo: { id: 7, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      permisos_efectivos: ["dashboard.ver", "ventas.ver"],
      capacidades: { puede_gestionar_perfiles: true, puede_cerrar_sesion_negocio: true },
    }

    await renderNavbar({ user: userDueno })

    expect(container.textContent).toContain("Dueño (Roman)")
    expect(container.textContent).toContain("ferreteria_central")
  })

  test("despliega acciones operativas (Cambiar perfil, Bloquear perfil, Cambiar mi PIN)", async () => {
    const onCambiarPerfil = jest.fn()
    const onBloquearPerfil = jest.fn()
    const onCambiarPin = jest.fn()

    const userOrdinario = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      perfil_activo: { id: 9, nombre: "María", etiqueta: "María", tipo: "ORDINARIO", es_dueno: false },
      permisos_efectivos: ["dashboard.ver", "ventas.ver"],
      capacidades: { puede_gestionar_perfiles: false, puede_cerrar_sesion_negocio: false },
    }

    await renderNavbar({
      user: userOrdinario,
      onCambiarPerfil,
      onBloquearPerfil,
      onCambiarPin,
    })

    // Abrir dropdown del perfil
    const botonPerfil = container.querySelector("button[aria-label='Abrir acciones del perfil']")
    await act(async () => botonPerfil.click())

    // Verificar presencia de las tres acciones operativas
    const botonCambiar = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Cambiar perfil")
    )
    const botonBloquear = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Bloquear perfil")
    )
    const botonPin = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Cambiar mi PIN")
    )

    expect(botonCambiar).toBeDefined()
    expect(botonBloquear).toBeDefined()
    expect(botonPin).toBeDefined()

    // Invocar cada una
    await act(async () => botonCambiar.click())
    expect(onCambiarPerfil).toHaveBeenCalled()

    await act(async () => botonBloquear.click())
    expect(onBloquearPerfil).toHaveBeenCalled()

    await act(async () => botonPin.click())
    expect(onCambiarPin).toHaveBeenCalled()
  })

  test("oculta 'Cerrar sesión del negocio' para perfiles ordinarios", async () => {
    const userOrdinario = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      perfil_activo: { id: 9, nombre: "María", etiqueta: "María", tipo: "ORDINARIO", es_dueno: false },
      permisos_efectivos: ["dashboard.ver", "ventas.ver"],
      capacidades: { puede_gestionar_perfiles: false, puede_cerrar_sesion_negocio: false },
    }

    await renderNavbar({ user: userOrdinario })

    const botonPerfil = container.querySelector("button[aria-label='Abrir acciones del perfil']")
    await act(async () => botonPerfil.click())

    // No debe existir el boton de logout para ordinarios
    const botonLogout = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Cerrar sesion del negocio")
    )
    expect(botonLogout).toBeUndefined()
  })

  test("muestra 'Cerrar sesión del negocio' cuando capacidades.puede_cerrar_sesion_negocio es true", async () => {
    const onLogoutMock = jest.fn()
    const userDueno = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      perfil_activo: { id: 7, nombre: "Roman", etiqueta: "Dueño (Roman)", tipo: "DUENO", es_dueno: true },
      permisos_efectivos: ["dashboard.ver", "ventas.ver"],
      capacidades: { puede_gestionar_perfiles: true, puede_cerrar_sesion_negocio: true },
    }

    await renderNavbar({ user: userDueno, onLogout: onLogoutMock })

    const botonPerfil = container.querySelector("button[aria-label='Abrir acciones del perfil']")
    await act(async () => botonPerfil.click())

    const botonLogout = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Cerrar sesion del negocio")
    )
    expect(botonLogout).toBeDefined()

    await act(async () => botonLogout.click())
    expect(onLogoutMock).toHaveBeenCalled()
  })

  test("filtra la navegacion segun permisos efectivos del usuario", async () => {
    const userVendedor = {
      cuenta: { username: "ferreteria_central" },
      perfiles_adoptados: true,
      perfil_activo: { id: 9, nombre: "María", etiqueta: "María", tipo: "ORDINARIO", es_dueno: false },
      permisos_efectivos: ["dashboard.ver", "ventas.ver"],
      capacidades: { puede_gestionar_perfiles: false, puede_cerrar_sesion_negocio: false },
    }

    await renderNavbar({ user: userVendedor })

    // Permisos otorgados: Panel Principal y Ventas
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"))
    expect(links).toContain("/home")
    expect(links).toContain("/home/presupuestos")

    // Modulos sin permiso: Clientes, Proveedores, Compras, Caja, Cuenta Corriente no deben aparecer
    expect(links).not.toContain("/home/clientes")
    expect(links).not.toContain("/home/proveedores")
    expect(links).not.toContain("/home/compras")
    expect(links).not.toContain("/home/caja")
    expect(links).not.toContain("/home/cuenta-corriente")
  })
})
