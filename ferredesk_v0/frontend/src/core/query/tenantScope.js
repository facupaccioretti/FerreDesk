export function obtenerTenantScope() {
  if (typeof window === "undefined" || !window.location?.host) {
    return "tenant-desconocido"
  }

  return window.location.host.toLowerCase()
}

export function normalizarParametrosQuery(parametros = {}) {
  const parametrosNormalizados = { ...parametros }

  Object.keys(parametrosNormalizados).forEach((clave) => {
    const valor = parametrosNormalizados[clave]
    if (valor === undefined || valor === null || valor === "") {
      delete parametrosNormalizados[clave]
    }
  })

  return parametrosNormalizados
}
