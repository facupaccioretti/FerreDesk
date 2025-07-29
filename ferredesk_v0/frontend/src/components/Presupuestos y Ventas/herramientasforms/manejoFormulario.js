/**
 * Maneja los cambios en los campos del formulario
 * @param {Function} setForm - Función para actualizar el estado del formulario
 * @returns {Function} Función manejadora de cambios
 */
export const manejarCambioFormulario = (setForm) => (e) => {
  const { name, value, type } = e.target;
  console.log(`[manejarCambioFormulario] Campo: ${name}, Valor: ${value}`);
  setForm(prevForm => {
    const newForm = {
      ...prevForm,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    };
    console.log('[manejarCambioFormulario] Nuevo estado:', newForm);
    return newForm;
  });
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
    plazoId: clienteSeleccionado?.plazoId || clienteSeleccionado?.plazo || '',
    descu1: clienteSeleccionado?.descu1 || 0,
    descu2: clienteSeleccionado?.descu2 || 0
  }));
};

export const manejarSeleccionClienteObjeto = (setForm) => (clienteSeleccionado) => {
  if (!clienteSeleccionado) return;
  console.log('[manejarSeleccionClienteObjeto] Cliente seleccionado:', clienteSeleccionado);
  setForm(prevForm => ({
    ...prevForm,
    clienteId: clienteSeleccionado.id,
    cuit: clienteSeleccionado.cuit || '',
    domicilio: clienteSeleccionado.domicilio || '',
    plazoId: clienteSeleccionado.plazoId || clienteSeleccionado.plazo || '',
    descu1: clienteSeleccionado.descu1 || 0,
    descu2: clienteSeleccionado.descu2 || 0,
    descu3: clienteSeleccionado.descu3 || 0,
    // 
    iva: clienteSeleccionado.iva || null,
    iva_nombre: clienteSeleccionado.iva_nombre || clienteSeleccionado.iva?.nombre || '',
    // Campos para documento (CUIT/DNI)
    ven_cuit: clienteSeleccionado.cuit || '',
    ven_dni: '',
  }));
}; 