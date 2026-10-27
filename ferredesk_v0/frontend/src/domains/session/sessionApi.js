import { clienteAPI } from "../../utils/clienteAPI"

export async function obtenerUsuarioSesion() {
  try {
    const data = await clienteAPI("/api/user/")
    return data?.status === "success" ? (data.user ?? null) : null
  } catch (error) {
    if (error?.status === 401) {
      return null
    }
    throw error
  }
}

export async function cerrarSesionActual() {
  return clienteAPI("/api/logout/", { method: "POST" })
}

export async function registrarActividadPerfil() {
  return clienteAPI("/api/usuarios/perfiles/actividad/", { method: "POST" })
}
