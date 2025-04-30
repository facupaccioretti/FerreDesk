"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function SignUpForm() {
  const [email, setEmail] = useState("lautarojuarez2002@gmail.com") // Pre-filled as requested
  const [password, setPassword] = useState("juarezromano") // Pre-filled as requested
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseConfigured()) {
      setError("Supabase no está configurado correctamente. Por favor, configure las variables de entorno.")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase!.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      setSuccess("Cuenta creada exitosamente. Ahora puede iniciar sesión.")
      setTimeout(() => {
        router.push("/")
      }, 2000)
    } catch (error: any) {
      setError(error.message || "Error al crear la cuenta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear Cuenta</CardTitle>
        <CardDescription>Ingrese sus datos para crear una cuenta</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          {success && <div className="rounded-md bg-green-100 p-3 text-sm text-green-800">{success}</div>}
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
          <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              "Crear Cuenta"
            )}
          </Button>
          <div className="text-center text-sm mt-2">
            ¿Ya tiene una cuenta?{" "}
            <Link href="/" className="text-primary hover:underline">
              Iniciar Sesión
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

