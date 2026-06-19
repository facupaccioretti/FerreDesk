import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../../core/query/queryKeys"
import { cerrarSesionActual } from "./sessionApi"

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: cerrarSesionActual,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.session.all })
    },
  })

  return {
    ...mutation,
    logout: mutation.mutateAsync,
  }
}
