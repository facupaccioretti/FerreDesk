import LoginForm from "@/components/login-form"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default async function Home() {
  // Only attempt to get session if Supabase is configured
  let isAuthenticated = false

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase!.auth.getSession()
      isAuthenticated = !!data.session

      // Client-side redirect will happen in the component
    } catch (error) {
      console.error("Error checking auth:", error)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sistema de Gestión de Clientes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Inicie sesión para acceder al sistema</p>
        </div>

        {!isSupabaseConfigured() && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuración incompleta</AlertTitle>
            <AlertDescription>
              Las variables de entorno de Supabase no están configuradas. Por favor, configure NEXT_PUBLIC_SUPABASE_URL
              y NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </AlertDescription>
          </Alert>
        )}

        <LoginForm isAuthenticated={isAuthenticated} />
      </div>
    </div>
  )
}

