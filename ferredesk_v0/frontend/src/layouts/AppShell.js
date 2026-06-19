import Navbar from "../components/Navbar"
import GlobalProcessBanner from "../components/processes/GlobalProcessBanner"
import ProcessCenterDrawer from "../components/processes/ProcessCenterDrawer"
import ProcessRouteGate from "../components/processes/ProcessRouteGate"
import { ProcessProvider } from "../context/ProcessContext"
import { useLogoutMutation } from "../domains/session/useLogoutMutation"
import { useSessionUserQuery } from "../domains/session/useSessionUserQuery"
import { AppShellProvider } from "../contexts/AppShellContext"

export default function AppShell({ children }) {
  const { user } = useSessionUserQuery()
  const { logout } = useLogoutMutation()

  const handleLogout = () => {
    logout().finally(() => {
      window.location.href = "/login/"
    })
  }

  return (
    <ProcessProvider>
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
  )
}
