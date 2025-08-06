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

  // Si no hay token ni sessionid y la ruta es /home, redirigir a /login
  if ((!token && !sessionid) && req.nextUrl.pathname.startsWith('/home')) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay token o sessionid y la ruta es /login o /register, redirigir a /home
  if ((token || sessionid) && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
    const dashboardUrl = new URL('/home', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next()
}

// Configurar las rutas que deben ser protegidas
export const config = {
  matcher: ['/home/:path*', '/login', '/register']
} 