import { useState, useEffect } from 'react';
import { getCookie } from '../utils/csrf';
//ese se usa para el formulario de Nuevo Producto
export function useStockProveAPI() {
  const [stockProve, setStockProve] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchStockProve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/stockprove/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener stockprove');
      const data = await res.json();
      setStockProve(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addStockProve = async ({ stock, proveedor, cantidad, costo, codigo_producto_proveedor, id }) => {
    setError(null);
    try {
      const payload = {
        stock: Number(stock),
        proveedor_id: Number(proveedor),
        cantidad: parseFloat(cantidad),
        costo: parseFloat(costo)
      };
      if (codigo_producto_proveedor !== undefined) payload.codigo_producto_proveedor = codigo_producto_proveedor;
      if (id !== undefined) payload.id = id;
      const res = await fetch('/api/productos/stockprove/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let errorMsg = 'Error al agregar stock por proveedor';
        try {
          const data = await res.json();
          errorMsg = data.detail || JSON.stringify(data);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStockProve = async (id, data) => {
    setError(null);
    try {
      const payload = {
        stock: Number(data.stockId ?? data.stock),
        proveedor_id: Number(data.proveedorId ?? data.proveedor),
        cantidad: parseFloat(data.cantidad),
        costo: parseFloat(data.costo)
      };
      if (data.codigo_producto_proveedor !== undefined) payload.codigo_producto_proveedor = data.codigo_producto_proveedor;
      const res = await fetch(`/api/productos/stockprove/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let errorMsg = 'Error al editar registro de stock de proveedor';
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || JSON.stringify(errorData);
        } catch (e) {}
        console.error('Error en updateStockProve:', errorMsg, 'Payload enviado:', payload);
        throw new Error(errorMsg);
      }
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteStockProve = async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/stockprove/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar registro');
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchStockProve();
  }, []);

  return { stockProve, loading, error, fetchStockProve, addStockProve, updateStockProve, deleteStockProve };
}

// este para Edicion de Producto
export function useStockProveEditAPI() {
  const [stockProve, setStockProve] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const csrftoken = getCookie('csrftoken');

  const fetchStockProve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/productos/stockprove/', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener stockprove');
      const data = await res.json();
      setStockProve(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addStockProve = async ({ stock, proveedor, cantidad, costo, codigo_producto_proveedor, id }) => {
    setError(null);
    try {
      const payload = {
        stock: Number(stock),
        proveedor_id: Number(proveedor),
        cantidad: parseFloat(cantidad),
        costo: parseFloat(costo)
      };
      if (codigo_producto_proveedor !== undefined) payload.codigo_producto_proveedor = codigo_producto_proveedor;
      if (id !== undefined) payload.id = id;
      const res = await fetch('/api/productos/stockprove/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let errorMsg = 'Error al agregar stock por proveedor';
        try {
          const data = await res.json();
          errorMsg = data.detail || JSON.stringify(data);
        } catch (e) {}
        throw new Error(errorMsg);
      }
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStockProve = async (id, data) => {
    setError(null);
    try {
      const payload = {
        stock: Number(data.stockId ?? data.stock),
        proveedor_id: Number(data.proveedorId ?? data.proveedor),
        cantidad: parseFloat(data.cantidad),
        costo: parseFloat(data.costo)
      };
      if (data.codigo_producto_proveedor !== undefined) payload.codigo_producto_proveedor = data.codigo_producto_proveedor;
      const res = await fetch(`/api/productos/stockprove/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let errorMsg = 'Error al editar registro de stock de proveedor';
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || JSON.stringify(errorData);
        } catch (e) {}
        console.error('Error en updateStockProve:', errorMsg, 'Payload enviado:', payload);
        throw new Error(errorMsg);
      }
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteStockProve = async (id) => {
    setError(null);
    try {
      const res = await fetch(`/api/productos/stockprove/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al eliminar registro');
      await fetchStockProve();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchStockProve();
  }, []);

  return { stockProve, loading, error, fetchStockProve, addStockProve, updateStockProve, deleteStockProve };
} 