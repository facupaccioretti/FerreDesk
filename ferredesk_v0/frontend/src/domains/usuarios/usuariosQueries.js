import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../../core/query/queryKeys"
import { withQueryProfile } from "../../core/query/queryProfiles"
import { obtenerPerfilesSeleccion } from "./usuariosApi"

export function usePerfilesSeleccionQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.usuarios.seleccion(),
    queryFn: obtenerPerfilesSeleccion,
    ...withQueryProfile("warmCatalog", {
      staleTime: 0,
      refetchOnMount: "always",
      ...options,
    }),
  })
}
