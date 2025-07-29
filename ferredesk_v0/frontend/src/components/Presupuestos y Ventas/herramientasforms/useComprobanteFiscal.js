import { useState, useEffect, useCallback } from 'react';
import { getCookie } from '../../../utils/csrf';

// Funciones de validación reutilizables
const validadores = {
  cuit: (cliente) => Boolean(cliente?.cuit?.trim()),
  razon_social: (cliente) => Boolean(cliente?.razon?.trim() || cliente?.nombre?.trim()),
  domicilio: (cliente) => Boolean(cliente?.domicilio?.trim())
};

// Mensajes de error base
const mensajesError = {
  cuit: (letra) => `El CUIT/CUIL es obligatorio para Factura ${letra}`,
  razon_social: () => 'La razón social es obligatoria',
  domicilio: () => 'El domicilio fiscal es obligatorio'
};

// Definición de requisitos base
const REQUISITOS_BASE = {
  cuit: {
    id: 'cuit',
    nombre: 'CUIT/CUIL',
    validar: validadores.cuit
  },
  razon_social: {
    id: 'razon_social',
    nombre: 'Razón Social',
    validar: validadores.razon_social
  },
  domicilio: {
    id: 'domicilio',
    nombre: 'Domicilio Fiscal',
    validar: validadores.domicilio
  }
};

// Definición de requisitos por tipo de comprobante
const REQUISITOS_POR_TIPO = {
  'A': {
    nombre: 'Factura A',
    requisitos: [
      { ...REQUISITOS_BASE.cuit, mensaje: mensajesError.cuit('A') },
      { ...REQUISITOS_BASE.razon_social, mensaje: mensajesError.razon_social() },
      { ...REQUISITOS_BASE.domicilio, mensaje: mensajesError.domicilio() }
    ]
  },
  'B': {
    nombre: 'Factura B',
    requisitos: [
      { ...REQUISITOS_BASE.cuit, mensaje: mensajesError.cuit('B') },
      { ...REQUISITOS_BASE.razon_social, mensaje: mensajesError.razon_social() },
      { ...REQUISITOS_BASE.domicilio, mensaje: mensajesError.domicilio() }
    ]
  },
  'C': {
    nombre: 'Factura C',
    requisitos: [
      { ...REQUISITOS_BASE.razon_social, mensaje: mensajesError.razon_social() },
      { ...REQUISITOS_BASE.domicilio, mensaje: mensajesError.domicilio() }
    ]
  }
};

/**
 * Hook híbrido para lógica fiscal de comprobantes
 * 
 * PROPÓSITO:
 * - Frontend: Preview visual en tiempo real (badge, validaciones)
 * - Backend: Lógica fiscal autoritaria (determina comprobante final)
 * 
 * FLUJO:
 * 1. Frontend muestra preview usando este hook
 * 2. Frontend envía solo TIPO al backend (no código AFIP)
 * 3. Backend ejecuta su propia lógica fiscal independientemente
 * 4. Si hay discrepancia, el backend siempre gana
 * 
 * MEJORA: El estado anterior se mantiene hasta que se complete la nueva lógica fiscal
 * para evitar que el cliente "desaparezca" visualmente cuando hay errores temporales.
 */
export function useComprobanteFiscal({ tipoComprobante, cliente }) {
  const [letra, setLetra] = useState('');
  const [codigoAfip, setCodigoAfip] = useState('');
  const [comprobanteFiscal, setComprobanteFiscal] = useState(null);
  const [requisitos, setRequisitos] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opcionDropdown, setOpcionDropdown] = useState(null);
  const [erroresValidacion, setErroresValidacion] = useState([]);
  const csrftoken = getCookie('csrftoken');

  // Función para limpiar estado
  const limpiarEstado = useCallback(() => {
    setLetra('');
    setCodigoAfip('');
    setComprobanteFiscal(null);
    setRequisitos({});
    setError(null);
    setOpcionDropdown(null);
    setErroresValidacion([]);
  }, []);

  // Función para validar requisitos
  const validarRequisitos = useCallback((letraComprobante, clienteActual) => {
    if (!letraComprobante || !clienteActual) {
      setRequisitos({});
      setErroresValidacion([]);
      return;
    }
    
    const requisitosTipo = REQUISITOS_POR_TIPO[letraComprobante]?.requisitos || [];
    const resultados = requisitosTipo.map(req => ({
      ...req,
      cumple: req.validar(clienteActual)
    }));

    const cumpleTodos = resultados.every(r => r.cumple);
    const mensajesError = resultados
      .filter(r => !r.cumple)
      .map(r => r.mensaje);

    // Determinar qué campos son requeridos según el tipo de factura
    const camposRequeridos = {
      cuit: letraComprobante !== 'C',
      domicilio: true,
      razon_social: true
    };

    setRequisitos({
      cumpleTodos,
      requisitos: resultados,
      mensajesError,
      camposRequeridos
    });
    setErroresValidacion(mensajesError);
  }, []);

  const fetchComprobanteFiscal = useCallback(async () => {
    console.log('[useComprobanteFiscal] Disparado con:', { tipoComprobante, cliente });
    setLoading(true);
    // Solo limpiar errores previos, mantener el estado anterior hasta completar
    setError(null);

    if (!tipoComprobante || !cliente) {
      console.log('[useComprobanteFiscal] Faltan datos para disparar lógica fiscal.');
      setLoading(false);
      return;
    }

    const situacion_iva_cliente = cliente.iva_nombre || cliente.iva?.nombre;

    // 
    console.log('[useComprobanteFiscal] Cliente completo:', cliente);
    console.log('[useComprobanteFiscal] Cliente.iva:', cliente.iva);
    console.log('[useComprobanteFiscal] Cliente.iva_nombre:', cliente.iva_nombre);
    console.log('[useComprobanteFiscal] Situación IVA cliente (final):', situacion_iva_cliente);

    // Validaciones estrictas
    if (situacion_iva_cliente === undefined || situacion_iva_cliente === null || situacion_iva_cliente === '') {
      const msg = '[useComprobanteFiscal] ERROR: El cliente no tiene IVA asignado. No se puede continuar.';
      console.error(msg, cliente);
      setError('El cliente seleccionado no tiene situación de IVA asignada.');
      setLoading(false);
      // No limpiar el estado anterior, solo mostrar el error
      return;
    }

    const payload = {
      tipo_comprobante: tipoComprobante,
      situacion_iva_cliente
    };

    console.log('[useComprobanteFiscal] Enviando payload al backend:', payload);
    try {
      const res = await fetch('/api/comprobantes/asignar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('[useComprobanteFiscal] Error de backend:', data);
        setError(data.detail || 'Error al obtener comprobante fiscal');
        setLoading(false);
        // No limpiar el estado anterior, solo mostrar el error
        return;
      }
      const data = await res.json();
      console.log('[useComprobanteFiscal] Respuesta del backend:', data);
      
      const letraComprobante = data.letra || '';
      
      // 
      console.log('[useComprobanteFiscal] Letra asignada:', letraComprobante);
      console.log('[useComprobanteFiscal] Código AFIP:', data.codigo_afip);
      console.log('[useComprobanteFiscal] Comprobante completo:', data);
      
      setLetra(letraComprobante);
      setCodigoAfip(data.codigo_afip || '');
      setComprobanteFiscal(data);
      // Validar requisitos con la letra obtenida
      validarRequisitos(letraComprobante, cliente);
      
      setOpcionDropdown({
        value: tipoComprobante,
        label: letraComprobante ? `Factura ${letraComprobante}` : tipoComprobante.charAt(0).toUpperCase() + tipoComprobante.slice(1),
        tipo: tipoComprobante,
        letra: letraComprobante
      });
    } catch (err) {
      console.error('[useComprobanteFiscal] Error de red o inesperado:', err);
      setError('Error de red o inesperado');
      // No limpiar el estado anterior, solo mostrar el error
    } finally {
      setLoading(false);
    }
  }, [tipoComprobante, cliente, csrftoken, limpiarEstado, validarRequisitos]);

  // Efecto para obtener comprobante fiscal
  useEffect(() => {
    fetchComprobanteFiscal();
  }, [fetchComprobanteFiscal]);

  return { 
    letra, 
    codigoAfip,
    comprobanteFiscal,
    requisitos, 
    loading, 
    error, 
    opcionDropdown,
    erroresValidacion,
    cumpleRequisitos: requisitos?.cumpleTodos || false,
    camposRequeridos: requisitos?.camposRequeridos || {}
  };
} 