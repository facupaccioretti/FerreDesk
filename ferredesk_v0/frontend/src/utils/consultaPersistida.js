import { operationalLocalStorage } from "../domains/session/operationalStorage"

export function leerConsultaPersistida(clave, fallback = null) {
  try {
    const raw = operationalLocalStorage.getItem(clave)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

export function guardarConsultaPersistida(clave, valor) {
  try {
    operationalLocalStorage.setItem(clave, JSON.stringify(valor))
  } catch (_) {
    // noop
  }
}

export function limpiarConsultaPersistida(clave) {
  try {
    operationalLocalStorage.removeItem(clave)
  } catch (_) {
    // noop
  }
}
