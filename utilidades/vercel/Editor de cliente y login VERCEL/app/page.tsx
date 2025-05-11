import LoginForm from "@/components/login-form"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sistema de Gestión de Clientes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pantalla de ejemplo. No hay autenticación real.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
