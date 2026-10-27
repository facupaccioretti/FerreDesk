import { clienteAPI } from "../../utils/clienteAPI"

export function obtenerPerfilesSeleccion() {
  return clienteAPI("/api/usuarios/perfiles/seleccion/")
}

export function activarPerfiles(datos) {
  return clienteAPI("/api/usuarios/activar-perfiles/", {
    method: "POST",
    body: datos,
  })
}

export function identificarPerfil({ perfilId, pin }) {
  return clienteAPI("/api/usuarios/perfiles/identificar/", {
    method: "POST",
    body: { perfil_id: perfilId, pin },
  })
}

export function cambiarPerfil({ perfilId, pin }) {
  return clienteAPI("/api/usuarios/perfiles/cambiar/", {
    method: "POST",
    body: { perfil_id: perfilId, pin },
  })
}

export function bloquearPerfil() {
  return clienteAPI("/api/usuarios/perfiles/bloquear/", { method: "POST" })
}

export function cambiarPinPropio(datos) {
  return clienteAPI("/api/usuarios/perfiles/pin/cambiar/", {
    method: "POST",
    body: datos,
  })
}
