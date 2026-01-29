/**
 * Hook para gestionar impresión de etiquetas de códigos de barras
 */
import { useState, useCallback } from 'react';
import { descargarPDFEtiquetas } from '../services/codigoBarrasApi';
import { FORMATO_ETIQUETA_DEFAULT } from '../constants';

const OPCIONES_INICIALES = {
  formatoEtiqueta: FORMATO_ETIQUETA_DEFAULT,
  cantidadPorProducto: 1,
  incluirNombre: true,
  incluirPrecio: false,
  listaPrecio: 0,
};

export const useImpresionEtiquetas = () => {
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [opciones, setOpciones] = useState(OPCIONES_INICIALES);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState(null);

  const agregarProducto = useCallback((productoId) => {
    setProductosSeleccionados((prev) => {
      if (prev.includes(productoId)) return prev;
      return [...prev, productoId];
    });
  }, []);

  const quitarProducto = useCallback((productoId) => {
    setProductosSeleccionados((prev) => prev.filter((id) => id !== productoId));
  }, []);

  const establecerProductos = useCallback((productos) => {
    setProductosSeleccionados(productos);
  }, []);

  const limpiarSeleccion = useCallback(() => {
    setProductosSeleccionados([]);
  }, []);

  const actualizarOpcion = useCallback((campo, valor) => {
    setOpciones((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }, []);

  const resetearOpciones = useCallback(() => {
    setOpciones(OPCIONES_INICIALES);
  }, []);

  const imprimir = useCallback(async () => {
    if (productosSeleccionados.length === 0) {
      setError('Debe seleccionar al menos un producto');
      return { exito: false, error: 'Debe seleccionar al menos un producto' };
    }

    setImprimiendo(true);
    setError(null);

    try {
      await descargarPDFEtiquetas({
        productos: productosSeleccionados,
        formato_etiqueta: opciones.formatoEtiqueta,
        cantidad_por_producto: opciones.cantidadPorProducto,
        incluir_nombre: opciones.incluirNombre,
        incluir_precio: opciones.incluirPrecio,
        lista_precio: opciones.listaPrecio,
      });
      return { exito: true };
    } catch (err) {
      setError(err.message);
      return { exito: false, error: err.message };
    } finally {
      setImprimiendo(false);
    }
  }, [productosSeleccionados, opciones]);

  return {
    productosSeleccionados,
    opciones,
    imprimiendo,
    error,
    tieneProductos: productosSeleccionados.length > 0,
    cantidadProductos: productosSeleccionados.length,
    agregarProducto,
    quitarProducto,
    establecerProductos,
    limpiarSeleccion,
    actualizarOpcion,
    resetearOpciones,
    imprimir,
  };
};
