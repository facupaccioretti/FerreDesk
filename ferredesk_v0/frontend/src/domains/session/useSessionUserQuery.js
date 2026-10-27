import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../../core/query/queryKeys"
import { withQueryProfile } from "../../core/query/queryProfiles"
import { obtenerUsuarioSesion } from "./sessionApi"

export function useSessionUserQuery(options = {}) {
  const query = useQuery({
    queryKey: queryKeys.session.user(),
    queryFn: obtenerUsuarioSesion,
    ...withQueryProfile("session", options),
    staleTime: 0,
    retry: (failureCount, error) => ![401, 403].includes(error?.status) && failureCount < 1,
  })

  return {
    ...query,
    user: query.data ?? null,
    isAuthenticated: Boolean(query.data),
    cuenta: query.data?.cuenta ?? null,
    perfilesAdoptados: Boolean(query.data?.perfiles_adoptados),
    requiereIdentificacion: Boolean(query.data?.requiere_identificacion),
    motivoRequiereIdentificacion: query.data?.motivo_requiere_identificacion ?? null,
    perfilActivo: query.data?.perfil_activo ?? null,
    permisosEfectivos: query.data?.permisos_efectivos ?? [],
    capacidades: query.data?.capacidades ?? {},
    inactividadSegundos: query.data?.inactividad_segundos ?? null,
  }
}
