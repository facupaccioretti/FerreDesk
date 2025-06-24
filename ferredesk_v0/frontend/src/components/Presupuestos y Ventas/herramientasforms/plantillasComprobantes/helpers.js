// helpers.js
// Funciones visuales y utilidades compartidas entre plantillas de comprobantes

/**
 * Formatea la columna de descuentos visualmente como "5+10+20".
 * @param {number} bonificacion - Bonificación particular del ítem
 * @param {number} descu1 - Descuento 1 general
 * @param {number} descu2 - Descuento 2 general
 * @param {number} descu3 - Descuento 3 general
 * @returns {string} Descuento visual
 */
export const formatearDescuentosVisual = (bonificacionItem = 0, descu1 = 0, descu2 = 0, descu3 = 0) => {
  const partes = [];
  const b = parseFloat(bonificacionItem);
  const d1 = parseFloat(descu1);
  const d2 = parseFloat(descu2);
  const d3 = parseFloat(descu3);
  if (!isNaN(b) && b > 0) partes.push(b % 1 === 0 ? b.toFixed(0) : b.toFixed(2));
  if (!isNaN(d1) && d1 > 0) partes.push(d1 % 1 === 0 ? d1.toFixed(0) : d1.toFixed(2));
  if (!isNaN(d2) && d2 > 0) partes.push(d2 % 1 === 0 ? d2.toFixed(0) : d2.toFixed(2));
  if (!isNaN(d3) && d3 > 0) partes.push(d3 % 1 === 0 ? d3.toFixed(0) : d3.toFixed(2));
  return partes.length ? partes.join('+') : '0';
};

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