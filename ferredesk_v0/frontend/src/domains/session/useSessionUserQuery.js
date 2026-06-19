import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../../core/query/queryKeys"
import { withQueryProfile } from "../../core/query/queryProfiles"
import { obtenerUsuarioSesion } from "./sessionApi"

export function useSessionUserQuery(options = {}) {
  const query = useQuery({
    queryKey: queryKeys.session.user(),
    queryFn: obtenerUsuarioSesion,
    ...withQueryProfile("session", options),
  })

  return {
    ...query,
    user: query.data ?? null,
    isAuthenticated: Boolean(query.data),
  }
}
