const RUTAS_SENSIBLES = [
  "/home/productos",
  "/home/compras",
  "/home/presupuestos",
  "/home/carga-inicial-proveedor",
]

function esRutaSensibles(pathname) {
  return RUTAS_SENSIBLES.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  )
}

export default function ProcessRouteGate({ children }) {
  // El bloqueo fue desactivado temporalmente por pedido del usuario.
  // Originalmente, este componente bloqueaba las rutas sensibles si había un proceso crítico activo.
  return children
}

export { esRutaSensibles }
