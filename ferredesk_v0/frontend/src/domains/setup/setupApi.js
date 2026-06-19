import { clienteAPI } from "../../utils/clienteAPI"

export async function obtenerEstadoSetup() {
  return clienteAPI("/api/ferreteria/estado-setup/")
}
