import { useQuery } from "@tanstack/react-query"
import { withQueryProfile } from "../../core/query/queryProfiles"
import { obtenerEstadoSetup } from "./setupApi"

const SETUP_QUERY_KEY = ["setup", "estado"]

export function useSetupStatusQuery(options = {}) {
  const query = useQuery({
    queryKey: SETUP_QUERY_KEY,
    queryFn: obtenerEstadoSetup,
    ...withQueryProfile("session", options),
  })

  return {
    ...query,
    setupStatus: query.data ?? null,
    setupCompleto: query.data?.setup_completo === true,
  }
}
