/**
 * Utilidades de fecha en hora local (evitan desfase por UTC en inputs YYYY-MM-DD).
 * Usar en formularios y filtros para que "hoy" coincida con la fecha del usuario.
 */

/**
 * Retorna la fecha de hoy en zona horaria local, formato YYYY-MM-DD.
 * Evita usar toISOString() que convierte a UTC y puede mostrar el día siguiente
 * en Argentina (UTC-3) después de las 21:00.
 * @returns {string} Fecha en formato 'YYYY-MM-DD'
 */
export function fechaHoyLocal() {
  return new Date().toLocaleDateString('en-CA')
}
