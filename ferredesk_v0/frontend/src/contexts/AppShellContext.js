import { createContext, useContext } from "react"

const AppShellContext = createContext({
  hasGlobalNavbar: false,
})

export function AppShellProvider({ value, children }) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShellContext() {
  return useContext(AppShellContext)
}
