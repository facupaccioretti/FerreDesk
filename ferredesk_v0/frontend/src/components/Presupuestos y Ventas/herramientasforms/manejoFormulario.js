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

/**
 * Valida el documento de un cliente y retorna la información para el componente CUIT/DNI
 * @param {Object} cliente - Objeto cliente con campo cuit
 * @returns {Object} Información del documento validada {tipo, valor, esValido}
 */
export const validarDocumentoCliente = (cliente) => {
  console.log('[validarDocumentoCliente] Cliente recibido:', cliente)
  
  if (!cliente?.cuit) {
    console.log('[validarDocumentoCliente] No hay CUIT, retornando vacío')
    return {
      tipo: 'cuit',
      valor: '',
      esValido: false
    }
  }

  const cuitLimpio = cliente.cuit.replace(/[-\s]/g, '')
  console.log('[validarDocumentoCliente] CUIT limpio:', cuitLimpio, 'longitud:', cuitLimpio.length)
  
  if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
    console.log('[validarDocumentoCliente] Es CUIT válido')
    return {
      tipo: 'cuit',
      valor: cliente.cuit,
      esValido: true
    }
  } else {
    console.log('[validarDocumentoCliente] Es DNI')
    return {
      tipo: 'dni',
      valor: cliente.cuit,
      esValido: true
    }
  }
}

export const manejarSeleccionClienteObjeto = (setForm) => (clienteSeleccionado) => {
  if (!clienteSeleccionado) return;
  console.log('[manejarSeleccionClienteObjeto] Cliente seleccionado:', clienteSeleccionado);
  
  // Lógica de validación del documento del cliente
  let ven_cuit = '';
  let ven_dni = '';
  
  if (clienteSeleccionado.cuit) {
    // Limpiar el CUIT de espacios y guiones para validar
    const cuitLimpio = clienteSeleccionado.cuit.replace(/[-\s]/g, '')
    
    // Validar si tiene exactamente 11 dígitos (CUIT válido)
    if (cuitLimpio.length === 11 && /^\d{11}$/.test(cuitLimpio)) {
      // Es un CUIT válido
      ven_cuit = clienteSeleccionado.cuit;
      ven_dni = '';
    } else {
      // No es un CUIT válido, tratar como DNI
      ven_cuit = '';
      ven_dni = clienteSeleccionado.cuit;
    }
  }
  
  setForm(prevForm => ({
    ...prevForm,
    clienteId: clienteSeleccionado.id,
    cuit: clienteSeleccionado.cuit || '',
    domicilio: clienteSeleccionado.domicilio || '',
    plazoId: clienteSeleccionado.plazoId || clienteSeleccionado.plazo || '',
    vendedorId: clienteSeleccionado.vendedorId || clienteSeleccionado.vendedor || '',
    descu1: clienteSeleccionado.descu1 || 0,
    descu2: clienteSeleccionado.descu2 || 0,
    descu3: clienteSeleccionado.descu3 || 0,
    // 
    iva: clienteSeleccionado.iva || null,
    iva_nombre: clienteSeleccionado.iva_nombre || clienteSeleccionado.iva?.nombre || '',
    // Campos para documento (CUIT/DNI) - validados según lógica fiscal
    ven_cuit: ven_cuit,
    ven_dni: ven_dni,
  }));
}; 