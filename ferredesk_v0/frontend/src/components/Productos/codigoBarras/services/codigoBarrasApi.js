/**
 * Servicios API para códigos de barras
 */
import { getCookie } from '../../../../utils/csrf';

const BASE_URL = '/api/productos/codigo-barras';

/**
 * Obtiene el código de barras de un producto
 */
export const obtenerCodigoBarras = async (productoId) => {
  const response = await fetch(`${BASE_URL}/producto/${productoId}/`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener código de barras');
  }
  
  return response.json();
};

/**
 * Asocia un código de barras existente a un producto
 */
export const asociarCodigoBarras = async (productoId, codigoBarras) => {
  const response = await fetch(`${BASE_URL}/producto/${productoId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    credentials: 'include',
    body: JSON.stringify({
      accion: 'asociar',
      codigo_barras: codigoBarras,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al asociar código de barras');
  }
  
  return response.json();
};

/**
 * Genera un código de barras interno para un producto
 */
export const generarCodigoBarras = async (productoId, formato) => {
  const response = await fetch(`${BASE_URL}/producto/${productoId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    credentials: 'include',
    body: JSON.stringify({
      accion: 'generar',
      formato,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al generar código de barras');
  }
  
  return response.json();
};

/**
 * Elimina el código de barras de un producto
 */
export const eliminarCodigoBarras = async (productoId) => {
  const response = await fetch(`${BASE_URL}/producto/${productoId}/`, {
    method: 'DELETE',
    headers: {
      'X-CSRFToken': getCookie('csrftoken'),
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al eliminar código de barras');
  }
  
  return response.json();
};

/**
 * Valida un código de barras
 */
export const validarCodigoBarras = async (codigoBarras) => {
  const response = await fetch(`${BASE_URL}/validar/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    credentials: 'include',
    body: JSON.stringify({
      codigo_barras: codigoBarras,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al validar código de barras');
  }
  
  return response.json();
};

/**
 * Genera PDF con etiquetas de códigos de barras
 */
export const imprimirEtiquetas = async (opciones) => {
  const response = await fetch(`${BASE_URL}/imprimir/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    credentials: 'include',
    body: JSON.stringify(opciones),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al generar etiquetas');
  }
  
  return response.blob();
};

/**
 * Descarga el PDF de etiquetas
 */
export const descargarPDFEtiquetas = async (opciones) => {
  const blob = await imprimirEtiquetas(opciones);
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'etiquetas_codigo_barras.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
