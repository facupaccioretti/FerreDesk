/**
 * Obtiene el ID del cliente por defecto (cuenta corriente)
 * @param {Array} clientes - Lista de clientes
 * @returns {string} ID del cliente por defecto
 */
export const obtenerClientePorDefecto = (clientes) => {
  const cc = clientes.find(c => (c.razon || c.nombre)?.toLowerCase().includes('cuenta corriente'));
  return cc ? cc.id : '';
};

/**
 * Obtiene el ID del plazo por defecto (contado)
 * @param {Array} plazos - Lista de plazos
 * @returns {string} ID del plazo por defecto
 */
export const obtenerPlazoPorDefecto = (plazos) => {
  const contado = plazos.find(p => (p.nombre || '').toLowerCase().includes('contado'));
  return contado ? contado.id : '';
}; 