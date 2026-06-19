export function leerConsultaPersistida(clave, fallback = null) {
  try {
    const raw = localStorage.getItem(clave)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

export function guardarConsultaPersistida(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch (_) {
    // noop
  }
}

export function limpiarConsultaPersistida(clave) {
  try {
    localStorage.removeItem(clave)
  } catch (_) {
    // noop
  }
}
