import { useState } from "react"
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
import { useBloquearPerfilMutation } from "../domains/usuarios/usuariosMutations"
import { AppShellProvider } from "../contexts/AppShellContext"
import CambiarPinModal from "../modules/usuarios/components/CambiarPinModal"
import PerfilOperativoGate from "../modules/usuarios/components/PerfilOperativoGate"
import SessionTransitionOverlay from "../modules/usuarios/components/SessionTransitionOverlay"

function AppShellRuntime({ children }) {
  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()
  const bloquearMutation = useBloquearPerfilMutation()
  const [cambiarPinAbierto, setCambiarPinAbierto] = useState(false)
  const {
    abrirCambioPerfil,
    marcarReidentificacionSuave,
    reportarErrorTransicion,
    sessionGeneration,
  } = useSessionCoordinator()
  useSessionSync()
  useInactivitySession()

  const handleLogout = () => {
    logout().finally(() => {
      window.location.href = "/login/"
    })
  }

  const handleBloquearPerfil = () => {
    marcarReidentificacionSuave(user?.perfil_activo?.id)
    bloquearMutation.mutateAsync().catch(reportarErrorTransicion)
  }

  return (
    <>
      <PerfilOperativoGate>
        <ProcessProvider key={sessionGeneration}>
          <AppShellProvider value={{ hasGlobalNavbar: true }}>
            <div className="min-h-screen bg-slate-50">
              <Navbar
                forceRender
                user={user}
                onBloquearPerfil={handleBloquearPerfil}
                onCambiarPerfil={abrirCambioPerfil}
                onCambiarPin={() => setCambiarPinAbierto(true)}
                onLogout={handleLogout}
              />
              <GlobalProcessBanner />
              <main>
                <ProcessRouteGate>{children}</ProcessRouteGate>
              </main>
              <ProcessCenterDrawer />
              <CambiarPinModal abierto={cambiarPinAbierto} onClose={() => setCambiarPinAbierto(false)} />
            </div>
          </AppShellProvider>
        </ProcessProvider>
      </PerfilOperativoGate>
      <SessionTransitionOverlay />
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
