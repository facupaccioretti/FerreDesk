import { useState, useCallback } from 'react';

const useOrdenCompraAPI = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [ordenesCompra, setOrdenesCompra] = useState([]);

    // Función base para hacer requests
    const makeRequest = useCallback(async (url, options = {}) => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value,
                },
                ...options,
            });

            // Respuestas sin contenido (e.g., 204 No Content)
            if (response.status === 204) {
                return null;
            }

            // Intentar parsear JSON solo si el Content-Type es JSON y hay contenido
            const contentType = response.headers.get('content-type') || '';
            const hasJson = contentType.includes('application/json');
            let payload = null;
            if (hasJson) {
                // Algunas respuestas pueden no tener cuerpo a pesar del content-type
                const text = await response.text();
                payload = text ? JSON.parse(text) : null;
            }

            if (!response.ok) {
                const detail = payload && (payload.detail || payload.error || payload.message);
                throw new Error(detail || `Error ${response.status}: ${response.statusText}`);
            }

            return payload;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Obtener lista de órdenes de compra
    const getOrdenesCompra = useCallback(async (params = {}) => {
        const queryParams = new URLSearchParams(params).toString();
        const url = `/api/ordenes-compra/${queryParams ? `?${queryParams}` : ''}`;
        const data = await makeRequest(url);
        // Soportar respuesta paginada (results) o lista directa
        const lista = Array.isArray(data) ? data : (data?.results ?? []);
        setOrdenesCompra(lista);
        return data;
    }, [makeRequest]);

    // Obtener una orden de compra específica
    const getOrdenCompra = useCallback(async (id) => {
        return await makeRequest(`/api/ordenes-compra/${id}/`);
    }, [makeRequest]);

    // Crear nueva orden de compra
    const createOrdenCompra = useCallback(async (data) => {
        return await makeRequest('/api/ordenes-compra/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }, [makeRequest]);

    // Actualizar orden de compra
    const updateOrdenCompra = useCallback(async (id, data) => {
        return await makeRequest(`/api/ordenes-compra/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }, [makeRequest]);

    // Eliminar orden de compra
    const deleteOrdenCompra = useCallback(async (id) => {
        return await makeRequest(`/api/ordenes-compra/${id}/`, {
            method: 'DELETE',
        });
    }, [makeRequest]);

    // Obtener items de una orden de compra
    const getOrdenCompraItems = useCallback(async (ordenId) => {
        return await makeRequest(`/api/ordenes-compra-items/?odi_idor=${ordenId}`);
    }, [makeRequest]);

    // Crear item de orden de compra
    const createOrdenCompraItem = useCallback(async (data) => {
        return await makeRequest('/api/ordenes-compra-items/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }, [makeRequest]);

    // Actualizar item de orden de compra
    const updateOrdenCompraItem = useCallback(async (id, data) => {
        return await makeRequest(`/api/ordenes-compra-items/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }, [makeRequest]);

    // Eliminar item de orden de compra
    const deleteOrdenCompraItem = useCallback(async (id) => {
        return await makeRequest(`/api/ordenes-compra-items/${id}/`, {
            method: 'DELETE',
        });
    }, [makeRequest]);

    // Convertir orden de compra a compra
    const convertirOrdenCompraACompra = useCallback(async (data) => {
        return await makeRequest('/api/convertir-orden-compra/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }, [makeRequest]);

    // Buscar productos por código de venta para un proveedor
    const buscarProductosPorCodigoVenta = useCallback(async (proveedorId, codigoVenta) => {
        const params = new URLSearchParams({
            proveedor_id: proveedorId,
            codigo_venta: codigoVenta,
        });
        return await makeRequest(`/api/compras/buscar-producto-proveedor/?${params}`);
    }, [makeRequest]);

    // Obtener productos de un proveedor
    const getProductosProveedor = useCallback(async (proveedorId) => {
        return await makeRequest(`/api/compras/proveedores/${proveedorId}/productos/`);
    }, [makeRequest]);

    // Obtener proveedores activos
    const getProveedoresActivos = useCallback(async () => {
        return await makeRequest('/api/compras/proveedores/activos/');
    }, [makeRequest]);

    return {
        loading,
        error,
        ordenesCompra,
        getOrdenesCompra,
        getOrdenCompra,
        createOrdenCompra,
        updateOrdenCompra,
        deleteOrdenCompra,
        getOrdenCompraItems,
        createOrdenCompraItem,
        updateOrdenCompraItem,
        deleteOrdenCompraItem,
        convertirOrdenCompraACompra,
        buscarProductosPorCodigoVenta,
        getProductosProveedor,
        getProveedoresActivos,
    };
};

export default useOrdenCompraAPI;
