import Navbar from "../components/Navbar"
import GlobalProcessBanner from "../components/processes/GlobalProcessBanner"
import ProcessCenterDrawer from "../components/processes/ProcessCenterDrawer"
import ProcessRouteGate from "../components/processes/ProcessRouteGate"
import { ProcessProvider } from "../context/ProcessContext"
import { useLogoutMutation } from "../domains/session/useLogoutMutation"
import { useSessionUserQuery } from "../domains/session/useSessionUserQuery"
import { SessionCoordinatorProvider, useSessionCoordinator } from "../domains/session/sessionCoordinator"
import { useSessionSync } from "../domains/session/useSessionSync"
import { useInactivitySession } from "../domains/session/useInactivitySession"
import { AppShellProvider } from "../contexts/AppShellContext"

function AppShellRuntime({ children }) {
  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()
  const {
    bloqueada,
    operationalReady,
    requiereReidentificacion,
    sessionGeneration,
    transitionError,
  } = useSessionCoordinator()
  useSessionSync()
  useInactivitySession()

  const handleLogout = () => {
    logout().finally(() => {
      window.location.href = "/login/"
    })
  }

  return (
    <>
      {operationalReady ? (
        <ProcessProvider key={sessionGeneration}>
          <AppShellProvider value={{ hasGlobalNavbar: true }}>
            <div className="min-h-screen bg-slate-50">
              <Navbar forceRender user={user} onLogout={handleLogout} />
              <GlobalProcessBanner />
              <main>
                <ProcessRouteGate>{children}</ProcessRouteGate>
              </main>
              <ProcessCenterDrawer />
            </div>
          </AppShellProvider>
        </ProcessProvider>
      ) : null}
      {bloqueada ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60" role="status" aria-live="polite">
          <div className="rounded-lg bg-white px-6 py-5 text-center shadow-xl">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-orange-600" />
            <p className="font-medium text-slate-800">
              {transitionError
                ? "No se pudo validar la sesion. Reintenta al recuperar la conexion."
                : requiereReidentificacion
                  ? "Se requiere identificar el perfil operativo."
                  : "Validando la sesion operativa..."}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function AppShell({ children }) {
  return (
    <SessionCoordinatorProvider>
      <AppShellRuntime>{children}</AppShellRuntime>
    </SessionCoordinatorProvider>
  )
}
