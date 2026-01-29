/**
 * Constantes para el módulo de códigos de barras
 */

// Tipos de código de barras
export const TIPO_EAN13 = 'EAN13';
export const TIPO_CODE128 = 'CODE128';
export const TIPO_EXTERNO = 'EXTERNO';

// Opciones para selector de formato
export const FORMATOS_GENERACION = [
  { value: TIPO_EAN13, label: 'EAN-13 (Estándar retail)' },
  { value: TIPO_CODE128, label: 'Code 128 (Interno con siglas)' },
];

// Formatos de etiquetas disponibles
export const FORMATOS_ETIQUETAS = [
  { value: '65', label: '65 etiquetas/hoja (38.1mm x 21.2mm)' },
  { value: '30', label: '30 etiquetas/hoja (66.7mm x 25.4mm)' },
  { value: '21', label: '21 etiquetas/hoja - Estándar (63.5mm x 38.1mm)' },
  { value: '10', label: '10 etiquetas/hoja (101.6mm x 50.8mm)' },
];

// Formato por defecto
export const FORMATO_ETIQUETA_DEFAULT = '21';

// Listas de precios disponibles
export const LISTAS_PRECIO = [
  { value: 0, label: 'Lista 0 (Base)' },
  { value: 1, label: 'Lista 1' },
  { value: 2, label: 'Lista 2' },
  { value: 3, label: 'Lista 3' },
  { value: 4, label: 'Lista 4' },
];

// Mensajes
export const MENSAJES = {
  CODIGO_ASOCIADO_EXITO: 'Código de barras asociado correctamente',
  CODIGO_GENERADO_EXITO: 'Código de barras generado correctamente',
  CODIGO_ELIMINADO_EXITO: 'Código de barras eliminado correctamente',
  ERROR_PRODUCTO_NO_ENCONTRADO: 'Producto no encontrado',
  ERROR_CODIGO_YA_EXISTE: 'Este código de barras ya está asociado a otro producto',
  ERROR_CODIGO_INVALIDO: 'El código de barras no es válido',
};
