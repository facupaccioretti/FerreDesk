import { useMutation } from "@tanstack/react-query"
import { registrarActividadPerfil } from "../session/sessionApi"
import { useSessionCoordinator } from "../session/sessionCoordinator"
import { publicarRevalidacionSesion } from "../session/useSessionSync"
import {
  activarPerfiles,
  bloquearPerfil,
  cambiarPerfil,
  cambiarPinPropio,
  identificarPerfil,
} from "./usuariosApi"

function useReinicioIdentidad(mutationFn) {
  const { transicionDura } = useSessionCoordinator()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await transicionDura()
      publicarRevalidacionSesion()
    },
  })
}

export function useActivarPerfilesMutation() {
  return useReinicioIdentidad(activarPerfiles)
}

export function useBloquearPerfilMutation() {
  return useReinicioIdentidad(bloquearPerfil)
}

export function useCambiarPinPropioMutation() {
  return useReinicioIdentidad(cambiarPinPropio)
}

export function useSeleccionarPerfilMutation({ modo, perfilAnteriorId }) {
  const { reidentificacionSuave, transicionDura } = useSessionCoordinator()

  return useMutation({
    mutationFn: (datos) => modo === "cambiar" ? cambiarPerfil(datos) : identificarPerfil(datos),
    onSuccess: async (respuesta) => {
      await registrarActividadPerfil().catch(() => {})
      const nuevoId = respuesta?.perfil_activo?.id ?? null
      if (perfilAnteriorId && nuevoId === perfilAnteriorId) {
        await reidentificacionSuave(perfilAnteriorId)
      } else {
        await transicionDura()
      }
      publicarRevalidacionSesion()
    },
  })
}
