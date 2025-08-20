import { useState, useEffect, useCallback, useRef } from 'react';

// Utilidad interna para saber si una función es válida
const esFuncion = (fn) => typeof fn === 'function';

// Genera una firma compacta de los ítems para comparar cambios semánticos
const crearFirmaItems = (items) => {
  if (!Array.isArray(items)) return '[]';
  try {
    return JSON.stringify(
      items.map((item) => ({
        id: item?.id ?? null,
        codigo: item?.codigo ?? '',
        denominacion: item?.denominacion ?? '',
        cantidad: item?.cantidad ?? 0,
        precio: item?.precio ?? '',
        precioFinal: item?.precioFinal ?? '',
        bonificacion: item?.bonificacion ?? 0,
        idaliiva: item?.idaliiva ?? null,
        productoId: item?.producto?.id ?? null,
        proveedorId: item?.proveedorId ?? null,
        vdi_idsto: item?.vdi_idsto ?? null,
        vdi_idpro: item?.vdi_idpro ?? null,
      }))
    );
  } catch (e) {
    return '[]';
  }
};

// Compara formularios ignorando diferencias de referencia; chequea campos escalares y firma de items
const sonFormulariosIguales = (formA, formB) => {
  if (formA === formB) return true;
  if (!formA || !formB) return false;

  const clavesEscalares = [
    'numero',
    'cliente',
    'clienteId',
    'cuit',
    'domicilio',
    'plazoId',
    'vendedorId',
    'sucursalId',
    'puntoVentaId',
    'fecha',
    'estado',
    'tipo',
    'bonificacionGeneral',
    'total',
    'descu1',
    'descu2',
    'descu3',
    'copia',
  ];

  for (const clave of clavesEscalares) {
    if ((formA?.[clave] ?? null) !== (formB?.[clave] ?? null)) return false;
  }

  const firmaA = crearFirmaItems(formA.items);
  const firmaB = crearFirmaItems(formB.items);
  return firmaA === firmaB;
};

/**
 * Hook para manejar la persistencia de formularios en localStorage
 * @param {Object} opciones - Opciones de configuración
 * @param {string} opciones.claveAlmacenamiento - Clave para almacenar en localStorage
 * @param {Object} opciones.datosIniciales - Datos iniciales del formulario
 * @param {Function} opciones.combinarConValoresPorDefecto - Función para combinar con valores por defecto
 * @param {Array} opciones.parametrosPorDefecto - Parámetros para combinarConValoresPorDefecto
 * @param {Function} opciones.normalizarItems - Función para normalizar items (opcional)
 * @param {Function} opciones.validarBorrador - Función para validar el borrador (opcional)
 * @returns {Object} Estado y funciones para manejar el borrador
 */
export const useFormularioDraft = ({
  claveAlmacenamiento,
  datosIniciales,
  combinarConValoresPorDefecto,
  parametrosPorDefecto = [],
  normalizarItems,
  validarBorrador
}) => {
  // Estado inicial del formulario
  const [formulario, setFormulario] = useState(() => {
    try {
      const savedData = localStorage.getItem(claveAlmacenamiento);
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          // Si hay función de validación y no pasa, ignorar borrador
          if (esFuncion(validarBorrador)) {
            const esValido = validarBorrador(parsedData, datosIniciales);
            if (!esValido) throw new Error('Borrador inválido');
          }
          return combinarConValoresPorDefecto(parsedData, ...parametrosPorDefecto);
        } catch (err) {
          // Si falla parsing o validación, continuar a datos iniciales
          console.info('[useFormularioDraft] Borrador descartado:', err.message);
        }
      }
    } catch (e) {
      console.error('Error al cargar borrador:', e);
    }
    return combinarConValoresPorDefecto(datosIniciales || {}, ...parametrosPorDefecto);
  });

  // Persistencia en localStorage solo cuando cambió el contenido semántico del formulario
  const ultimaFirmaRef = useRef('');
  useEffect(() => {
    const firmaActual = (() => {
      try {
        const copiaLigera = { ...formulario, items: undefined };
        const firmaBase = JSON.stringify(copiaLigera);
        const firmaItems = crearFirmaItems(formulario.items);
        return `${firmaBase}|items:${firmaItems}`;
      } catch (e) {
        return String(Date.now());
      }
    })();

    if (firmaActual === ultimaFirmaRef.current) return; // No escribir si no cambió
    ultimaFirmaRef.current = firmaActual;

    try {
      localStorage.setItem(claveAlmacenamiento, JSON.stringify(formulario));
    } catch (e) {
      console.error('Error al guardar borrador:', e);
    }
  }, [formulario, claveAlmacenamiento]);

  // Rehidratación tardía desde borrador cuando datosIniciales aún no estaban listos al montar
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(claveAlmacenamiento);
      if (!savedData) return;
      const parsedData = JSON.parse(savedData);
      if (esFuncion(validarBorrador)) {
        const esValido = validarBorrador(parsedData, datosIniciales);
        if (!esValido) return;
      }
      let combinado = combinarConValoresPorDefecto(parsedData, ...parametrosPorDefecto);
      if (esFuncion(normalizarItems) && Array.isArray(combinado.items)) {
        try {
          combinado = { ...combinado, items: normalizarItems(combinado.items) };
        } catch (_) {}
      }
      if (!sonFormulariosIguales(formulario, combinado)) {
        setFormulario(combinado);
      }
    } catch (_) {
      // Ignorar errores de rehidratación tardía
    }
  }, [claveAlmacenamiento, datosIniciales, combinarConValoresPorDefecto, parametrosPorDefecto, normalizarItems, validarBorrador, formulario]);

  // Inicialización tardía con datosIniciales cuando al montar no estaban listos y no hay borrador válido
  useEffect(() => {
    if (!datosIniciales || (typeof datosIniciales === 'object' && Object.keys(datosIniciales).length === 0)) return;
    // Si hay borrador guardado, no forzar inicialización desde datos iniciales (prioridad al borrador)
    const savedData = localStorage.getItem(claveAlmacenamiento);
    if (savedData) return;
    const baseVacia = combinarConValoresPorDefecto({}, ...parametrosPorDefecto);
    // Solo proceder si el formulario actual coincide con la base vacía
    if (!sonFormulariosIguales(formulario, baseVacia)) return;
    let combinado = combinarConValoresPorDefecto(datosIniciales || {}, ...parametrosPorDefecto);
    if (esFuncion(normalizarItems) && Array.isArray(combinado.items)) {
      try {
        combinado = { ...combinado, items: normalizarItems(combinado.items) };
      } catch (_) {}
    }
    if (!sonFormulariosIguales(formulario, combinado)) {
      setFormulario(combinado);
    }
  }, [datosIniciales, claveAlmacenamiento, combinarConValoresPorDefecto, parametrosPorDefecto, normalizarItems, formulario]);

  // Función para limpiar el borrador
  const limpiarBorrador = () => {
    localStorage.removeItem(claveAlmacenamiento);
    setFormulario(combinarConValoresPorDefecto({}, ...parametrosPorDefecto));
  };

  // Función para actualizar el formulario
  const actualizarFormulario = useCallback((nuevosDatos) => {
    setFormulario((formularioPrevio) => {
      const candidato = { ...formularioPrevio, ...nuevosDatos };
      return sonFormulariosIguales(formularioPrevio, candidato) ? formularioPrevio : candidato;
    });
  }, []);

  // Función para actualizar items
  const actualizarItems = useCallback((items) => {
    setFormulario((formularioPrevio) => {
      const firmaAnterior = crearFirmaItems(formularioPrevio.items);
      const firmaNueva = crearFirmaItems(items);
      if (firmaAnterior === firmaNueva) return formularioPrevio; // No hay cambios reales
      return { ...formularioPrevio, items };
    });
  }, []);

  return {
    formulario,
    setFormulario,
    limpiarBorrador,
    actualizarFormulario,
    actualizarItems
  };
}; 