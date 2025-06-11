// utilidadesGrillaProductos.js

// Cantidad inicial por defecto para una nueva fila en la grilla de productos.
// Modificar este valor si la lógica de negocio lo requiere en el futuro.
const CANTIDAD_INICIAL_FILA = 1; // Valor por defecto para la cantidad en una fila vacía.

/**
 * Devuelve un objeto representando una fila vacía para la grilla de productos.
 * Incluye todos los campos necesarios para inicializar una fila.
 * @returns {Object} Fila vacía con campos por defecto.
 */
export function obtenerFilaVacia() {
  return {
    id: Date.now() + Math.random(), // Identificador único para la fila
    codigo: '',
    denominacion: '',
    unidad: '',
    cantidad: CANTIDAD_INICIAL_FILA,
    precio: '',
    bonificacion: 0,
    producto: null,
    proveedorId: '',
    idaliiva: null
  };
}

/**
 * Determina si una fila está llena, es decir, si tiene un producto asignado.
 * @param {Object} fila - La fila a evaluar.
 * @returns {boolean}
 */
export function esFilaLlena(fila) {
  return !!fila.producto;
}

/**
 * Determina si una fila está vacía, es decir, sin producto, código ni denominación.
 * @param {Object} fila - La fila a evaluar.
 * @returns {boolean}
 */
export function esFilaVacia(fila) {
  return (
    !fila.producto &&
    (!fila.codigo || fila.codigo.trim() === '') &&
    (!fila.denominacion || fila.denominacion.trim() === '')
  );
}

/**
 * Garantiza que solo haya una fila editable (vacía) en la grilla.
 * Elimina filas vacías intermedias y agrega una nueva vacía si es necesario.
 * @param {Array<Object>} filas - El array de filas actual.
 * @returns {Array<Object>} - El array de filas ajustado.
 */
export function asegurarSoloUnEditable(filas) {
  let resultado = filas.slice();

  // Eliminar vacíos intermedios (excepto el último)
  for (let i = resultado.length - 2; i >= 0; i--) {
    if (esFilaVacia(resultado[i])) {
      resultado.splice(i, 1);
    }
  }

  // Si hay más de una fila sin producto, dejar solo la última
  const indicesSinProducto = resultado
    .map((fila, idx) => (!esFilaLlena(fila) ? idx : -1))
    .filter(idx => idx !== -1);

  if (indicesSinProducto.length > 1) {
    // Eliminar todas menos la última vacía
    for (let i = 0; i < indicesSinProducto.length - 1; i++) {
      resultado.splice(indicesSinProducto[i], 1);
    }
  }

  // Si ya hay una fila vacía, no agregar otra
  if (resultado.some(fila => !esFilaLlena(fila))) {
    // Asegurar que la última vacía tenga un id único
    const ultima = resultado[resultado.length - 1];
    if (ultima && !ultima.id) {
      ultima.id = Date.now() + Math.random();
    }
    return resultado;
  }

  // Si todas las filas tienen producto, agregar una vacía al final
  resultado.push(obtenerFilaVacia());
  return resultado;
}

/**
 * Devuelve un mapa de productos/proveedores duplicados en la grilla.
 * La clave es `${idProducto}-${idProveedor}` y el valor es la cantidad de repeticiones.
 * @param {Array<Object>} filas - El array de filas actual.
 * @returns {Object} - Un mapa con claves producto-proveedor y valores de cantidad de repeticiones.
 */
export function obtenerMapaDuplicados(filas) {
  const mapa = {};
  filas.forEach(fila => {
    if (fila.producto && fila.proveedorId) {
      const clave = `${fila.producto.id}-${fila.proveedorId}`;
      mapa[clave] = (mapa[clave] || 0) + 1;
    }
  });
  return mapa;
}

/**
 * Determina si una fila es duplicada según el mapa de duplicados.
 * @param {Object} fila - La fila a evaluar.
 * @param {number} indice - El índice de la fila en el array.
 * @param {Object} mapaDuplicados - El mapa generado por obtenerMapaDuplicados.
 * @returns {boolean}
 */
export function esDuplicado(fila, indice, mapaDuplicados) {
  if (!fila.producto || !fila.proveedorId) return false;
  const clave = `${fila.producto.id}-${fila.proveedorId}`;
  return mapaDuplicados[clave] > 1;
}