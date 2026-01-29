/**
 * Utilidades para cálculos de precios de listas.
 */

/**
 * Calcula el precio de una lista (1-4) desde el precio de Lista 0.
 * 
 * @param {number} precioLista0 - Precio base (Lista 0)
 * @param {number} margenDescuento - Porcentaje de descuento (-) o recargo (+)
 * @returns {number} Precio calculado redondeado a 2 decimales
 * 
 * @example
 * calcularPrecioLista(1000, -10) // Descuento 10% -> 900
 * calcularPrecioLista(1000, 15)  // Recargo 15% -> 1150
 */
export function calcularPrecioLista(precioLista0, margenDescuento) {
  const precio = Number(precioLista0) || 0;
  const margen = Number(margenDescuento) || 0;
  
  const resultado = precio * (1 + margen / 100);
  return Math.round(resultado * 100) / 100;
}

/**
 * Calcula el precio de Lista 0 desde costo y margen de ganancia.
 * 
 * @param {number} costo - Costo del producto
 * @param {number} margenGanancia - Porcentaje de ganancia
 * @returns {number} Precio de Lista 0 redondeado a 2 decimales
 * 
 * @example
 * calcularPrecioLista0(1000, 40) // Costo 1000, Margen 40% -> 1400
 */
export function calcularPrecioLista0(costo, margenGanancia) {
  const costoNum = Number(costo) || 0;
  const margenNum = Number(margenGanancia) || 0;
  
  const resultado = costoNum * (1 + margenNum / 100);
  return Math.round(resultado * 100) / 100;
}

/**
 * Calcula el margen de ganancia desde precio de venta y costo.
 * 
 * @param {number} precioVenta - Precio de venta
 * @param {number} costo - Costo del producto
 * @returns {number} Porcentaje de margen redondeado a 2 decimales
 * 
 * @example
 * calcularMargenDesdePrecios(1400, 1000) // -> 40 (40%)
 */
export function calcularMargenDesdePrecios(precioVenta, costo) {
  const precioNum = Number(precioVenta) || 0;
  const costoNum = Number(costo) || 0;
  
  if (costoNum === 0) return 0;
  
  const margen = ((precioNum - costoNum) / costoNum) * 100;
  return Math.round(margen * 100) / 100;
}

/**
 * Obtiene el precio de un producto para una lista específica.
 * Busca primero en precios_listas, si no existe calcula desde Lista 0.
 * 
 * @param {Object} producto - Objeto del producto con precio_lista_0 y precios_listas
 * @param {number} listaNumero - Número de lista (0-4)
 * @param {Array} listasConfig - Configuración de listas con márgenes
 * @returns {number} Precio para la lista especificada
 */
export function obtenerPrecioParaLista(producto, listaNumero, listasConfig = []) {
  // Si es lista 0, usar precio_lista_0 directamente
  if (listaNumero === 0) {
    return Number(producto?.precio_lista_0) || 0;
  }
  
  // Buscar precio en precios_listas
  const precioLista = producto?.precios_listas?.find(
    p => p.lista_numero === listaNumero
  );
  
  if (precioLista?.precio) {
    return Number(precioLista.precio);
  }
  
  // Si no existe, calcular desde Lista 0 + margen de la lista
  const precioLista0 = Number(producto?.precio_lista_0) || 0;
  if (!precioLista0) return 0;
  
  const listaConfig = listasConfig.find(l => l.numero === listaNumero);
  const margenLista = Number(listaConfig?.margen_descuento) || 0;
  
  return calcularPrecioLista(precioLista0, margenLista);
}

/**
 * Formatea un precio para mostrar en la UI.
 * 
 * @param {number} precio - Precio a formatear
 * @param {string} moneda - Símbolo de moneda (default: '$')
 * @returns {string} Precio formateado
 * 
 * @example
 * formatearPrecio(1234.5) // -> "$1.234,50"
 */
export function formatearPrecio(precio, moneda = '$') {
  const numero = Number(precio) || 0;
  return `${moneda}${numero.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Verifica si un precio de lista es manual o calculado.
 * 
 * @param {Object} producto - Objeto del producto
 * @param {number} listaNumero - Número de lista (0-4)
 * @returns {boolean} true si es manual, false si es calculado
 */
export function esPrecioManual(producto, listaNumero) {
  if (listaNumero === 0) {
    return Boolean(producto?.precio_lista_0_manual);
  }
  
  const precioLista = producto?.precios_listas?.find(
    p => p.lista_numero === listaNumero
  );
  
  return Boolean(precioLista?.precio_manual);
}
