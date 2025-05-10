import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Allow guest access to dashboard if guest parameter is present
  if (req.nextUrl.pathname.startsWith("/dashboard") && req.nextUrl.searchParams.has("guest")) {
    return res
  }

  // Check if Supabase environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip authentication checks if Supabase isn't configured
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("Supabase environment variables not configured, skipping auth check in middleware")
    return res
  }

  try {
    const supabase = createMiddlewareClient({ req, res })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Solo redirigir a / si el usuario no está autenticado y está intentando acceder a rutas protegidas
    if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    // No redirigir automáticamente desde la landing page al dashboard
    // Esto permitirá que la landing page sea accesible incluso para usuarios autenticados
  } catch (error) {
    console.error("Middleware error:", error)
    // If there's an error with Supabase, just continue without redirecting
  }

  return res
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/sign-up"],
}

