/**
 * Hook personalizado para interactuar con la API del módulo Caja.
 * 
 * Provee funciones para:
 * - Consultar estado de caja (mi-caja)
 * - Abrir caja
 * - Cerrar caja (Cierre Z)
 * - Consultar estado sin cerrar (Cierre X)
 * - Registrar movimientos manuales
 * - Obtener métodos de pago
 */

import { useState, useCallback } from 'react';
import { getCookie } from './csrf';

const API_BASE = '/api/caja';

export function useCajaAPI() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Función base para hacer requests a la API.
     */
    const makeRequest = useCallback(async (url, options = {}) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                    ...options.headers,
                },
                credentials: 'include',
                ...options,
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.detail || data.error || 'Error en la operación';
                const errorCode = data.error_code || null;
                const err = new Error(errorMessage);
                err.code = errorCode;
                err.status = response.status;
                throw err;
            }

            return data;
        } catch (err) {
            if (err.code) {
                setError(err);
                throw err;
            }
            const errorObj = { message: err.message || 'Error de conexión', code: null };
            setError(errorObj);
            throw errorObj;
        } finally {
            setLoading(false);
        }
    }, []);

    // ========================================
    // SESIONES DE CAJA
    // ========================================

    /**
     * Obtiene la caja abierta del usuario actual, si existe.
     * @returns {Promise<{tiene_caja_abierta: boolean, sesion: object|null}>}
     */
    const obtenerMiCaja = useCallback(async () => {
        return makeRequest(`${API_BASE}/sesiones/mi-caja/`);
    }, [makeRequest]);

    /**
     * Abre una nueva sesión de caja.
     * @param {string|number} saldoInicial - Saldo inicial declarado
     * @param {number} sucursal - ID de sucursal (opcional, default 1)
     * @returns {Promise<object>} - Sesión creada
     */
    const abrirCaja = useCallback(async (saldoInicial, sucursal = 1) => {
        return makeRequest(`${API_BASE}/sesiones/abrir/`, {
            method: 'POST',
            body: JSON.stringify({
                saldo_inicial: saldoInicial,
                sucursal: sucursal,
            }),
        });
    }, [makeRequest]);

    /**
     * Cierra la caja actual (Cierre Z).
     * @param {string|number} saldoFinalDeclarado - Saldo contado físicamente
     * @param {string} observaciones - Observaciones opcionales
     * @returns {Promise<{sesion: object, resumen: object}>}
     */
    const cerrarCaja = useCallback(async (saldoFinalDeclarado, observaciones = '') => {
        return makeRequest(`${API_BASE}/sesiones/cerrar/`, {
            method: 'POST',
            body: JSON.stringify({
                saldo_final_declarado: saldoFinalDeclarado,
                observaciones_cierre: observaciones,
            }),
        });
    }, [makeRequest]);

    /**
     * Consulta el estado actual de la caja sin cerrarla (Cierre X).
     * @returns {Promise<{sesion: object, resumen: object}>}
     */
    const obtenerEstadoCaja = useCallback(async () => {
        return makeRequest(`${API_BASE}/sesiones/estado/`);
    }, [makeRequest]);

    /**
     * Obtiene el historial de sesiones de caja.
     * @param {object} filtros - Filtros opcionales (estado, solo_mias)
     * @returns {Promise<Array>}
     */
    const obtenerHistorialSesiones = useCallback(async (filtros = {}) => {
        const params = new URLSearchParams();
        if (filtros.estado) params.append('estado', filtros.estado);
        if (filtros.solo_mias) params.append('solo_mias', 'true');

        const queryString = params.toString();
        const url = `${API_BASE}/sesiones/${queryString ? '?' + queryString : ''}`;
        return makeRequest(url);
    }, [makeRequest]);

    /**
     * Obtiene el resumen completo de una sesión de caja específica.
     * @param {number} sesionId - ID de la sesión
     * @returns {Promise<{sesion: object, resumen: object}>}
     */
    const obtenerResumenCaja = useCallback(async (sesionId) => {
        return makeRequest(`${API_BASE}/sesiones/${sesionId}/resumen/`);
    }, [makeRequest]);

    // ========================================
    // MOVIMIENTOS DE CAJA
    // ========================================

    /**
     * Registra un movimiento manual (ingreso o egreso).
     * @param {string} tipo - 'ENTRADA' o 'SALIDA'
     * @param {string|number} monto - Monto del movimiento
     * @param {string} descripcion - Descripción del movimiento
     * @returns {Promise<object>} - Movimiento creado
     */
    const registrarMovimiento = useCallback(async (tipo, monto, descripcion) => {
        return makeRequest(`${API_BASE}/movimientos/`, {
            method: 'POST',
            body: JSON.stringify({
                tipo: tipo,
                monto: monto,
                descripcion: descripcion,
            }),
        });
    }, [makeRequest]);

    /**
     * Obtiene los movimientos de una sesión de caja.
     * @param {number} sesionId - ID de la sesión (opcional, si no se pasa obtiene todos)
     * @returns {Promise<Array>}
     */
    const obtenerMovimientos = useCallback(async (sesionId = null) => {
        const url = sesionId
            ? `${API_BASE}/movimientos/?sesion_caja=${sesionId}`
            : `${API_BASE}/movimientos/`;
        return makeRequest(url);
    }, [makeRequest]);

    // ========================================
    // MÉTODOS DE PAGO
    // ========================================

    /**
     * Obtiene los métodos de pago disponibles.
     * @param {boolean} soloActivos - Si true, solo retorna métodos activos
     * @returns {Promise<Array>}
     */
    const obtenerMetodosPago = useCallback(async (soloActivos = true) => {
        const url = soloActivos
            ? `${API_BASE}/metodos-pago/?solo_activos=true`
            : `${API_BASE}/metodos-pago/?solo_activos=false`;
        return makeRequest(url);
    }, [makeRequest]);

    // ========================================
    // PAGOS DE VENTAS
    // ========================================

    /**
     * Obtiene los pagos de una venta específica.
     * @param {number} ventaId - ID de la venta
     * @returns {Promise<Array>}
     */
    const obtenerPagosVenta = useCallback(async (ventaId) => {
        return makeRequest(`${API_BASE}/pagos/?venta=${ventaId}`);
    }, [makeRequest]);

    return {
        // Estado
        loading,
        error,

        // Sesiones
        obtenerMiCaja,
        abrirCaja,
        cerrarCaja,
        obtenerEstadoCaja,
        obtenerHistorialSesiones,
        obtenerResumenCaja,

        // Movimientos
        registrarMovimiento,
        obtenerMovimientos,

        // Métodos de pago
        obtenerMetodosPago,

        // Pagos
        obtenerPagosVenta,
    };
}

export default useCajaAPI;
