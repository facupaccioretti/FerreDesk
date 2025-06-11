import { useState, useEffect } from 'react';

/**
 * Hook para manejar la persistencia de formularios en localStorage
 * @param {Object} opciones - Opciones de configuración
 * @param {string} opciones.claveAlmacenamiento - Clave para almacenar en localStorage
 * @param {Object} opciones.datosIniciales - Datos iniciales del formulario
 * @param {Function} opciones.combinarConValoresPorDefecto - Función para combinar con valores por defecto
 * @param {Array} opciones.parametrosPorDefecto - Parámetros para combinarConValoresPorDefecto
 * @param {Function} opciones.normalizarItems - Función para normalizar items (opcional)
 * @returns {Object} Estado y funciones para manejar el borrador
 */
export const useFormularioDraft = ({
  claveAlmacenamiento,
  datosIniciales,
  combinarConValoresPorDefecto,
  parametrosPorDefecto = [],
  normalizarItems
}) => {
  // Estado inicial del formulario
  const [formulario, setFormulario] = useState(() => {
    try {
      const savedData = localStorage.getItem(claveAlmacenamiento);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        return combinarConValoresPorDefecto(parsedData, ...parametrosPorDefecto);
      }
    } catch (e) {
      console.error('Error al cargar borrador:', e);
    }
    return combinarConValoresPorDefecto(datosIniciales || {}, ...parametrosPorDefecto);
  });

  // Efecto para persistir cambios en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(claveAlmacenamiento, JSON.stringify(formulario));
    } catch (e) {
      console.error('Error al guardar borrador:', e);
    }
  }, [formulario, claveAlmacenamiento]);

  // Función para limpiar el borrador
  const limpiarBorrador = () => {
    localStorage.removeItem(claveAlmacenamiento);
    setFormulario(combinarConValoresPorDefecto({}, ...parametrosPorDefecto));
  };

  // Función para actualizar el formulario
  const actualizarFormulario = (nuevosDatos) => {
    setFormulario(prev => ({
      ...prev,
      ...nuevosDatos
    }));
  };

  // Función para actualizar items
  const actualizarItems = (items) => {
    setFormulario(prev => ({
      ...prev,
      items: items
    }));
  };

  return {
    formulario,
    setFormulario,
    limpiarBorrador,
    actualizarFormulario,
    actualizarItems
  };
}; 