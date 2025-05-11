import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  // Obtener el token de las cookies
  const token = req.cookies.get('token')?.value
  const sessionid = req.cookies.get('sessionid')?.value
  const isAuthenticationFlow = req.nextUrl.searchParams.get('authFlow') === 'true';

  // Si estamos en un proceso de autenticación, permitir la redirección
  if (isAuthenticationFlow) {
    return NextResponse.next();
  }

  // Si no hay token ni sessionid y la ruta es /dashboard, redirigir a /login
  if ((!token && !sessionid) && req.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay token o sessionid y la ruta es /login o /register, redirigir a /dashboard
  if ((token || sessionid) && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next()
}

// Configurar las rutas que deben ser protegidas
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register']
} 