import { useState, useCallback } from 'react';

const useCuentaCorrienteAPI = () => {
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

    // Obtener clientes con movimientos
    const getClientesConMovimientos = useCallback(async () => {
        try {
            const data = await makeRequest('/api/cuenta-corriente/clientes-con-movimientos/');
            return data;
        } catch (err) {
            console.error("Error fetching clientes con movimientos:", err);
            return { clientes: [] };
        }
    }, [makeRequest]);

    // Obtener cuenta corriente de un cliente
    const getCuentaCorrienteCliente = useCallback(async (clienteId, fechaDesde, fechaHasta, completo = false) => {
        try {
            const params = new URLSearchParams();
            if (fechaDesde) params.append('fecha_desde', fechaDesde);
            if (fechaHasta) params.append('fecha_hasta', fechaHasta);
            params.append('completo', completo);

            const url = `/api/cuenta-corriente/cliente/${clienteId}/?${params}`;
            const data = await makeRequest(url);
            return data;
        } catch (err) {
            console.error(`Error fetching cuenta corriente para cliente ${clienteId}:`, err);
            return { cliente: null, items: [], saldo_total: '0.00', total_items: 0 };
        }
    }, [makeRequest]);

    // Obtener facturas pendientes de un cliente
    const getFacturasPendientes = useCallback(async (clienteId) => {
        try {
            const data = await makeRequest(`/api/cuenta-corriente/cliente/${clienteId}/facturas-pendientes/`);
            return data;
        } catch (err) {
            console.error(`Error fetching facturas pendientes para cliente ${clienteId}:`, err);
            return { cliente: null, facturas: [], total_facturas: 0, total_pendiente: '0.00' };
        }
    }, [makeRequest]);

    // Crear recibo con imputaciones
    const crearReciboConImputaciones = useCallback(async (reciboData) => {
        return await makeRequest('/api/cuenta-corriente/crear-recibo/', {
            method: 'POST',
            body: JSON.stringify(reciboData),
        });
    }, [makeRequest]);

    // Imputar recibo o nota de crédito existente
    const imputarExistente = useCallback(async (imputacionData) => {
        return await makeRequest('/api/cuenta-corriente/imputar-existente/', {
            method: 'POST',
            body: JSON.stringify(imputacionData),
        });
    }, [makeRequest]);

    // Obtener detalle de comprobante (ver modal detalle)
    const getDetalleComprobante = useCallback(async (venId) => {
        try {
            const response = await fetch(`/api/cuenta-corriente/comprobante/${venId}/detalle/`, {
                credentials: 'include',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value,
                },
            })
            const contentType = response.headers.get('content-type') || ''
            if (!response.ok) {
                // leer texto para evitar JSON parse error
                const text = await response.text()
                throw new Error(text || `Error ${response.status}`)
            }
            if (!contentType.includes('application/json')) {
                // fallback a objeto básico vacío; el modal mostrará datos mínimos del item
                return { cabecera: null, totales: null, items: [], imputaciones_realizadas: [], imputaciones_recibidas: [], asociados_nc: [] }
            }
            return await response.json()
        } catch (err) {
            console.error('Error obteniendo detalle comprobante:', err)
            throw err
        }
    }, [])

    // Alias para cargar facturas pendientes (usado en modales)
    const cargarFacturasPendientes = useCallback(async (clienteId) => {
        const data = await getFacturasPendientes(clienteId);
        return data.facturas || [];
    }, [getFacturasPendientes]);

    // Anular recibo completo
    const anularRecibo = useCallback(async (reciboId) => {
        return await makeRequest('/api/cuenta-corriente/anular-recibo/', {
            method: 'POST',
            body: JSON.stringify({ recibo_id: reciboId }),
        });
    }, [makeRequest]);

    // Anular autoimputación (FacRecibo/CotRecibo)
    const anularAutoimputacion = useCallback(async (ventaId) => {
        return await makeRequest('/api/cuenta-corriente/anular-autoimputacion/', {
            method: 'POST',
            body: JSON.stringify({ venta_id: ventaId }),
        });
    }, [makeRequest]);

    // Modificar imputaciones de un recibo o nota de crédito
    const modificarImputaciones = useCallback(async (comprobanteId, imputaciones) => {
        return await makeRequest('/api/cuenta-corriente/modificar-imputaciones/', {
            method: 'POST',
            body: JSON.stringify({
                comprobante_id: comprobanteId,
                imputaciones
            }),
        });
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
            return Array.isArray(data) ? data : (data.results || []);
        } catch (err) {
            console.error("Error fetching cheques en cartera:", err);
            return [];
        }
    }, [makeRequest]);

    // Exportar cuenta corriente a Excel
    const exportarCuentaCorriente = useCallback(async (clienteId, fechaDesde, fechaHasta, completo = false) => {
        const params = new URLSearchParams();
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        params.append('completo', completo);
        params.append('formato', 'excel');

        const url = `/api/cuenta-corriente/cliente/${clienteId}/export/?${params}`;

        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value,
                },
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Descargar el archivo Excel
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `cuenta-corriente-cliente-${clienteId}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            return { success: true };
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        loading,
        error,
        getClientesConMovimientos,
        getCuentaCorrienteCliente,
        getFacturasPendientes,
        crearReciboConImputaciones,
        imputarExistente,
        cargarFacturasPendientes,
        getDetalleComprobante,
        anularRecibo,
        anularAutoimputacion,
        modificarImputaciones,
        getMetodosPago,
        getCuentasBanco,
        getChequesEnCartera,
        exportarCuentaCorriente,
    };
};

export default useCuentaCorrienteAPI;
export { useCuentaCorrienteAPI };
