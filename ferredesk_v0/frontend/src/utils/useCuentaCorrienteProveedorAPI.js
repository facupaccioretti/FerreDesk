import { useState, useCallback } from 'react';

const useCuentaCorrienteProveedorAPI = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type') || '';
            const hasJson = contentType.includes('application/json');
            let payload = null;
            if (hasJson) {
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

    // Obtener proveedores con movimientos en CC
    const getProveedoresConMovimientos = useCallback(async () => {
        try {
            const data = await makeRequest('/api/cuenta-corriente/proveedores-con-movimientos/');
            return data;
        } catch (err) {
            console.error("Error fetching proveedores con movimientos:", err);
            return { proveedores: [] };
        }
    }, [makeRequest]);

    // Obtener cuenta corriente de un proveedor
    const getCuentaCorrienteProveedor = useCallback(async (proveedorId, fechaDesde, fechaHasta) => {
        try {
            let query = `/api/cuenta-corriente/proveedor/${proveedorId}/`;
            const params = [];
            if (fechaDesde) params.push(`fecha_desde=${fechaDesde}`);
            if (fechaHasta) params.push(`fecha_hasta=${fechaHasta}`);

            if (params.length > 0) {
                query += `?${params.join('&')}`;
            }

            const data = await makeRequest(query);
            return data;
        } catch (err) {
            console.error(`Error fetching cuenta corriente para proveedor ${proveedorId}:`, err);
            return { proveedor_id: null, movimientos: [], saldo_total: '0.00' };
        }
    }, [makeRequest]);

    // Obtener compras pendientes de un proveedor
    const getComprasPendientes = useCallback(async (proveedorId) => {
        try {
            const data = await makeRequest(`/api/cuenta-corriente/proveedor/${proveedorId}/compras-pendientes/`);
            return data;
        } catch (err) {
            console.error(`Error fetching compras pendientes para proveedor ${proveedorId}:`, err);
            return { compras_pendientes: [] };
        }
    }, [makeRequest]);

    // Crear orden de pago
    const crearOrdenPago = useCallback(async (ordenData) => {
        return await makeRequest('/api/cuenta-corriente/crear-orden-pago/', {
            method: 'POST',
            body: JSON.stringify(ordenData),
        });
    }, [makeRequest]);

    // Anular orden de pago
    const anularOrdenPago = useCallback(async (ordenPagoId) => {
        return await makeRequest(`/api/cuenta-corriente/anular-orden-pago/${ordenPagoId}/`, {
            method: 'POST'
        });
    }, [makeRequest]);

    // Obtener facturas pendientes de un proveedor
    const getFacturasPendientes = useCallback(async (proveedorId) => {
        return await makeRequest(`/api/cuenta-corriente/proveedor/${proveedorId}/facturas-pendientes/`);
    }, [makeRequest]);

    // Imputar orden de pago o nota de crédito
    const imputarOrdenPago = useCallback(async (datosImputacion) => {
        return await makeRequest(`/api/cuenta-corriente/proveedor/imputar/`, {
            method: 'POST',
            body: JSON.stringify(datosImputacion)
        });
    }, [makeRequest]);

    // Obtener detalle de un comprobante de proveedor
    const getDetalleComprobanteProveedor = useCallback(async (comprobanteId) => {
        return await makeRequest(`/api/cuenta-corriente/comprobante-proveedor/${comprobanteId}/detalle/`);
    }, [makeRequest]);

    // Obtener métodos de pago
    const getMetodosPago = useCallback(async () => {
        try {
            const data = await makeRequest('/api/caja/metodos-pago/');
            return data;
        } catch (err) {
            console.error("Error fetching metodos pago:", err);
            return [];
        }
    }, [makeRequest]);

    // Obtener cuentas banco
    const getCuentasBanco = useCallback(async () => {
        try {
            const data = await makeRequest('/api/caja/cuentas-banco/');
            return data;
        } catch (err) {
            console.error("Error fetching cuentas banco:", err);
            return [];
        }
    }, [makeRequest]);

    // Obtener cheques en cartera
    const getChequesEnCartera = useCallback(async () => {
        try {
            const data = await makeRequest('/api/caja/cheques/?estado=EN_CARTERA');
            // DRF ViewSet responses are usually paginated { results: [...] } or direct lists [...]
            return Array.isArray(data) ? data : (data.results || []);
        } catch (err) {
            console.error("Error fetching cheques en cartera:", err);
            return [];
        }
    }, [makeRequest]);

    return {
        loading,
        error,
        getProveedoresConMovimientos,
        getCuentaCorrienteProveedor,
        getComprasPendientes,
        crearOrdenPago,
        anularOrdenPago,
        getMetodosPago,
        getCuentasBanco,
        getChequesEnCartera,
        getFacturasPendientes,
        imputarOrdenPago,
        getDetalleComprobanteProveedor,
    };
};

export default useCuentaCorrienteProveedorAPI;
export { useCuentaCorrienteProveedorAPI };
