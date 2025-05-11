import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  // Middleware vacío, puedes agregar lógica personalizada aquí si lo necesitas en el futuro
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/sign-up"],
}
