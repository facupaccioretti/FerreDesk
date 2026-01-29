/**
 * Hook para gestionar códigos de barras de productos
 */
import { useState, useCallback } from 'react';
import {
  obtenerCodigoBarras,
  asociarCodigoBarras,
  generarCodigoBarras,
  eliminarCodigoBarras,
  validarCodigoBarras,
} from '../services/codigoBarrasApi';
import { MENSAJES } from '../constants';

export const useCodigoBarras = (productoId) => {
  const [codigoBarras, setCodigoBarras] = useState(null);
  const [tipoCodigoBarras, setTipoCodigoBarras] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [validacion, setValidacion] = useState(null);

  const cargar = useCallback(async () => {
    if (!productoId) return;
    
    setCargando(true);
    setError(null);
    
    try {
      const data = await obtenerCodigoBarras(productoId);
      setCodigoBarras(data.codigo_barras);
      setTipoCodigoBarras(data.tipo_codigo_barras);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  const asociar = useCallback(async (codigo) => {
    if (!productoId) return { exito: false, error: MENSAJES.ERROR_PRODUCTO_NO_ENCONTRADO };
    
    setCargando(true);
    setError(null);
    
    try {
      const data = await asociarCodigoBarras(productoId, codigo);
      setCodigoBarras(data.codigo_barras);
      setTipoCodigoBarras(data.tipo_codigo_barras);
      return { 
        exito: true, 
        mensaje: MENSAJES.CODIGO_ASOCIADO_EXITO, 
        codigo: data.codigo_barras,
        tipo: data.tipo_codigo_barras
      };
    } catch (err) {
      setError(err.message);
      return { exito: false, error: err.message };
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  const generar = useCallback(async (formato) => {
    if (!productoId) return { exito: false, error: MENSAJES.ERROR_PRODUCTO_NO_ENCONTRADO };
    
    setCargando(true);
    setError(null);
    
    try {
      const data = await generarCodigoBarras(productoId, formato);
      setCodigoBarras(data.codigo_barras);
      setTipoCodigoBarras(data.tipo_codigo_barras);
      return { exito: true, mensaje: MENSAJES.CODIGO_GENERADO_EXITO, codigo: data.codigo_barras };
    } catch (err) {
      setError(err.message);
      return { exito: false, error: err.message };
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  const eliminar = useCallback(async () => {
    if (!productoId) return { exito: false, error: MENSAJES.ERROR_PRODUCTO_NO_ENCONTRADO };
    
    setCargando(true);
    setError(null);
    
    try {
      await eliminarCodigoBarras(productoId);
      setCodigoBarras(null);
      setTipoCodigoBarras(null);
      return { exito: true, mensaje: MENSAJES.CODIGO_ELIMINADO_EXITO };
    } catch (err) {
      setError(err.message);
      return { exito: false, error: err.message };
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  const validar = useCallback(async (codigo) => {
    setCargando(true);
    setValidacion(null);
    
    try {
      const resultado = await validarCodigoBarras(codigo);
      setValidacion(resultado);
      return resultado;
    } catch (err) {
      setValidacion({ valido: false, error: err.message });
      return { valido: false, error: err.message };
    } finally {
      setCargando(false);
    }
  }, []);

  const limpiarValidacion = useCallback(() => {
    setValidacion(null);
  }, []);

  return {
    codigoBarras,
    tipoCodigoBarras,
    cargando,
    error,
    validacion,
    tieneCodigoBarras: !!codigoBarras,
    cargar,
    asociar,
    generar,
    eliminar,
    validar,
    limpiarValidacion,
  };
};
