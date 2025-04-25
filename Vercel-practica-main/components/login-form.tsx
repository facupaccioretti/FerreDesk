"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Loader2, UserRound } from "lucide-react"

interface LoginFormProps {
  isAuthenticated?: boolean
}

export default function LoginForm({ isAuthenticated = false }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check if user is already authenticated and redirect if needed
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseConfigured()) {
      setError("Supabase no está configurado correctamente. Por favor, configure las variables de entorno.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  const handleGuestAccess = () => {
    setGuestLoading(true)
    // Store guest mode in localStorage
    localStorage.setItem("guestMode", "true")
    // Redirect to dashboard
    router.push("/dashboard?guest=true")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
        <CardDescription>Ingrese sus credenciales para acceder al sistema</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando...
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGuestAccess}
            disabled={guestLoading}
          >
            {guestLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accediendo...
              </>
            ) : (
              <>
                <UserRound className="mr-2 h-4 w-4" />
                Acceder como Invitado
              </>
            )}
          </Button>

          <div className="text-center text-sm mt-2">
            ¿No tiene una cuenta?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Crear Cuenta
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

