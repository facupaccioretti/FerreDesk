import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cerrarSesionActual } from "./sessionApi"
import { establecerPerfilEsperado } from "../../utils/clienteAPI"
import { deshabilitarStorageOperativo, limpiarEstadoOperativo } from "./operationalStorage"

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: cerrarSesionActual,
    onSuccess: () => {
      establecerPerfilEsperado(null)
      limpiarEstadoOperativo()
      deshabilitarStorageOperativo()
      queryClient.clear()
    },
  })

  return {
    ...mutation,
    logout: mutation.mutateAsync,
  }
}
