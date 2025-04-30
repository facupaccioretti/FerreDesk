"use client"

import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { LogOut, UserIcon } from "lucide-react"

interface DashboardHeaderProps {
  user?: User
  isGuestMode?: boolean
}

export default function DashboardHeader({ user, isGuestMode = false }: DashboardHeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    if (isGuestMode) {
      // Clear guest mode from localStorage
      localStorage.removeItem("guestMode")
      router.push("/")
      return
    }

    if (isSupabaseConfigured()) {
      await supabase!.auth.signOut()
      router.push("/")
      router.refresh()
    }
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="font-semibold">Sistema de Gestión</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-4 w-4" />
            <span>{isGuestMode ? "Usuario Invitado" : user?.email}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {isGuestMode ? "Salir" : "Cerrar Sesión"}
          </Button>
        </div>
      </div>
    </header>
  )
}

