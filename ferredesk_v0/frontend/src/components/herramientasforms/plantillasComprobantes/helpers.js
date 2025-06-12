// helpers.js
// Funciones visuales y utilidades compartidas entre plantillas de comprobantes

/**
 * Formatea la columna de descuentos visualmente como "5+10+20".
 * @param {number} bonificacion - Bonificación particular del ítem
 * @param {number} descu1 - Descuento 1 general
 * @param {number} descu2 - Descuento 2 general
 * @returns {string} Descuento visual
 */
export function formatearDescuentosVisual(bonificacion, descu1, descu2) {
  let partes = [];
  if (bonificacion && bonificacion > 0) partes.push(bonificacion);
  if (descu1 && descu1 > 0) partes.push(descu1);
  if (descu2 && descu2 > 0) partes.push(descu2);
  return partes.length > 0 ? partes.join('+') : '0';
}

/**
 * Formatea un número como moneda con dos decimales
 * @param {number|string} valor
 * @returns {string}
 */
export function formatearMoneda(valor) {
  if (typeof valor === 'number') return valor.toFixed(2);
  if (typeof valor === 'string' && !isNaN(valor)) return Number(valor).toFixed(2);
  return '0.00';
}

// Otros helpers visuales compartidos pueden agregarse aquí 