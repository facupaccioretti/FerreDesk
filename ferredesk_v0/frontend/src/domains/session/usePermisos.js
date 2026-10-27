import { useCallback, useMemo } from "react"
import { useSessionUserQuery } from "./useSessionUserQuery"

export function usePermisos() {
  const { permisosEfectivos } = useSessionUserQuery()
  const permisos = useMemo(() => new Set(permisosEfectivos), [permisosEfectivos])

  const tienePermiso = useCallback((permiso) => permisos.has(permiso), [permisos])
  const tieneAlguno = useCallback(
    (permisosRequeridos = []) => permisosRequeridos.some((permiso) => permisos.has(permiso)),
    [permisos]
  )
  const tieneTodos = useCallback(
    (permisosRequeridos = []) => permisosRequeridos.every((permiso) => permisos.has(permiso)),
    [permisos]
  )

  return { tieneAlguno, tienePermiso, tieneTodos }
}
