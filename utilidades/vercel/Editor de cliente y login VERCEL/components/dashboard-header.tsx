"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut, UserIcon } from "lucide-react"

interface DashboardHeaderProps {
  // Ya no se usa user ni isGuestMode
}

export default function DashboardHeader({}: DashboardHeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    // Simplemente redirige al login
    router.push("/")
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <img src="/logo-fd.png" alt="Logo FD" className="h-8 w-8" />
          <span className="font-semibold">Sistema de Gestión</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-4 w-4" />
            <span>Usuario de ejemplo</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>
    </header>
  )
}
