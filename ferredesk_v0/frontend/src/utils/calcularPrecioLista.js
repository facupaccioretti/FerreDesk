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
 * Calcula el precio de Lista 0 desde costo, margen de ganancia e IVA (Precio Final).
 * 
 * @param {number} costo - Costo del producto
 * @param {number} margenGanancia - Porcentaje de ganancia
 * @param {number} porcentajeIVA - Porcentaje de IVA (ej: 21)
 * @returns {number} Precio de Lista 0 (Final) redondeado a 2 decimales
 * 
 * @example
 * calcularPrecioLista0(1000, 40, 21) // Costo 1000, Margen 40%, IVA 21% -> 1000 * 1.4 * 1.21 = 1694
 */
export function calcularPrecioLista0(costo, margenGanancia, porcentajeIVA = 0) {
  const costoNum = Number(costo) || 0;
  const margenNum = Number(margenGanancia) || 0;
  const ivaNum = Number(porcentajeIVA) || 0;

  // Precio Neto = Costo * (1 + Margen/100)
  // Precio Final = Precio Neto * (1 + IVA/100)
  const resultado = costoNum * (1 + margenNum / 100) * (1 + ivaNum / 100);
  return Math.round(resultado * 100) / 100;
}

/**
 * Calcula el margen de ganancia desde precio de venta (final), costo e IVA.
 * 
 * @param {number} precioVentaFinal - Precio de venta final (con IVA)
 * @param {number} costo - Costo del producto
 * @param {number} porcentajeIVA - Porcentaje de IVA (ej: 21)
 * @returns {number} Porcentaje de margen redondeado a 2 decimales
 * 
 * @example
 * calcularMargenDesdePrecios(1694, 1000, 21) // -> 40 (40%)
 */
export function calcularMargenDesdePrecios(precioVentaFinal, costo, porcentajeIVA = 0) {
  const precioFinalNum = Number(precioVentaFinal) || 0;
  const costoNum = Number(costo) || 0;
  const ivaNum = Number(porcentajeIVA) || 0;

  if (costoNum === 0) return 0;

  // Precio Neto = Precio Final / (1 + IVA/100)
  // Margen = ((Precio Neto - Costo) / Costo) * 100
  const precioNeto = precioFinalNum / (1 + ivaNum / 100);
  const margen = ((precioNeto - costoNum) / costoNum) * 100;
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
