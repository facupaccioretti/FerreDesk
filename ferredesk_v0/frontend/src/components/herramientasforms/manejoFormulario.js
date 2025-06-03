/**
 * Maneja los cambios en los campos del formulario
 * @param {Function} setForm - Función para actualizar el estado del formulario
 * @returns {Function} Función manejadora de cambios
 */
export const manejarCambioFormulario = (setForm) => (e) => {
  const { name, value, type } = e.target;
  setForm(prevForm => ({
    ...prevForm,
    [name]: type === 'number' ? parseFloat(value) : value
  }));
};

/**
 * Maneja el cambio de cliente y autocompleta campos relacionados
 * @param {Function} setForm - Función para actualizar el estado del formulario
 * @param {Array} clientes - Lista de clientes disponibles
 * @returns {Function} Función manejadora de cambios de cliente
 */
export const manejarCambioCliente = (setForm, clientes) => (e) => {
  const { value } = e.target;
  // Convertir ambos IDs a string para asegurar la comparación
  const clienteSeleccionado = clientes.find(c => String(c.id) === String(value));
  
  setForm(prevForm => ({
    ...prevForm,
    clienteId: value,
    cuit: clienteSeleccionado?.cuit || '',
    domicilio: clienteSeleccionado?.domicilio || '',
    plazoId: clienteSeleccionado?.plazoId || clienteSeleccionado?.plazo || ''
  }));
}; 