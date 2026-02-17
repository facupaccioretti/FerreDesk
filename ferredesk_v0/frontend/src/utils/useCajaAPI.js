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

    // ========================================
    // CUENTAS BANCO
    // ========================================

    /**
     * Obtiene las cuentas bancarias / billeteras configuradas.
     * @param {boolean} soloActivas - Si true, solo retorna cuentas activas
     * @returns {Promise<Array>}
     */
    const obtenerCuentasBanco = useCallback(async (soloActivas = false) => {
        const url = soloActivas
            ? `${API_BASE}/cuentas-banco/?solo_activas=true`
            : `${API_BASE}/cuentas-banco/`;
        return makeRequest(url);
    }, [makeRequest]);

    // ========================================
    // CHEQUES (VALORES EN CARTERA)
    // ========================================

    /**
     * Obtiene cheques, opcionalmente filtrados por estado.
     * @param {string|null} estado - EN_CARTERA | DEPOSITADO | ENTREGADO | RECHAZADO
     * @returns {Promise<Array|{results:Array}>}
     */
    const obtenerCheques = useCallback(async (estado = null) => {
        const url = estado
            ? `${API_BASE}/cheques/?estado=${encodeURIComponent(estado)}`
            : `${API_BASE}/cheques/`;
        return makeRequest(url);
    }, [makeRequest]);

    /**
     * Deposita un cheque a una cuenta propia.
     * @param {number} chequeId 
     * @param {number} cuentaBancoId 
     * @returns {Promise<object>}
     */
    const depositarCheque = useCallback(async (chequeId, cuentaBancoId) => {
        return makeRequest(`${API_BASE}/cheques/${chequeId}/depositar/`, {
            method: 'POST',
            body: JSON.stringify({ cuenta_banco_id: cuentaBancoId }),
        });
    }, [makeRequest]);

    /**
     * Endosa cheques seleccionados a un proveedor.
     * @param {number} proveedorId 
     * @param {Array<number>} chequeIds 
     * @returns {Promise<object>}
     */
    const endosarCheques = useCallback(async (proveedorId, chequeIds) => {
        return makeRequest(`${API_BASE}/cheques/endosar/`, {
            method: 'POST',
            body: JSON.stringify({ proveedor_id: proveedorId, cheque_ids: chequeIds }),
        });
    }, [makeRequest]);

    /**
     * Marca un cheque como rechazado: genera ND automática y contrasiento si estaba depositado.
     * @param {number} chequeId - ID del cheque
     * @param {{ cargosAdministrativosBanco?: number|null }} opciones - Opcional. cargosAdministrativosBanco: monto que debitó el banco (se agrega como ítem no gravado en la ND).
     * @returns {Promise<object>} - Cheque actualizado (con nota_debito_venta_id, cliente_origen, etc.)
     */
    const marcarChequeRechazado = useCallback(async (chequeId, opciones = {}) => {
        const body = {};
        if (opciones.cargosAdministrativosBanco != null && Number(opciones.cargosAdministrativosBanco) > 0) {
            body.cargos_administrativos_banco = Number(opciones.cargosAdministrativosBanco);
        }
        return makeRequest(`${API_BASE}/cheques/${chequeId}/marcar-rechazado/`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }, [makeRequest]);

    /**
     * Reactiva un cheque rechazado (RECHAZADO → EN_CARTERA).
     * @param {number} chequeId - ID del cheque
     * @returns {Promise<object>} - Cheque actualizado
     */
    const reactivarCheque = useCallback(async (chequeId) => {
        return makeRequest(`${API_BASE}/cheques/${chequeId}/reactivar/`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    }, [makeRequest]);

    /**
     * Marca un cheque DEPOSITADO como ACREDITADO (fondos efectivamente ingresados al banco).
     * @param {number} chequeId - ID del cheque
     * @param {number} cuentaBancoId - ID de la cuenta bancaria donde se acreditaron los fondos
     * @returns {Promise<object>} - Cheque actualizado
     */
    const acreditarCheque = useCallback(async (chequeId, cuentaBancoId) => {
        return makeRequest(`${API_BASE}/cheques/${chequeId}/acreditar/`, {
            method: 'POST',
            body: JSON.stringify({ cuenta_banco_id: cuentaBancoId }),
        });
    }, [makeRequest]);

    /**
     * Obtiene el detalle completo de un cheque con historial.
     * @param {number} chequeId - ID del cheque
     * @returns {Promise<object>} - Cheque con historial y fechas calculadas
     */
    const obtenerDetalleCheque = useCallback(async (chequeId) => {
        return makeRequest(`${API_BASE}/cheques/${chequeId}/detalle/`);
    }, [makeRequest]);

    /**
     * Edita los datos de un cheque que está EN_CARTERA.
     * @param {number} chequeId - ID del cheque
     * @param {object} datos - Datos a actualizar (numero, banco_emisor, monto, cuit_librador, fecha_emision, fecha_presentacion)
     * @returns {Promise<object>} - Cheque actualizado
     */
    const editarCheque = useCallback(async (chequeId, datos) => {
        return makeRequest(`${API_BASE}/cheques/${chequeId}/editar/`, {
            method: 'PATCH',
            body: JSON.stringify(datos),
        });
    }, [makeRequest]);

    /**
     * Obtiene alertas de cheques por vencer en los próximos N días.
     * @param {number} dias - Ventana de alerta en días (default 5)
     * @returns {Promise<{dias: number, cantidad: number}>}
     */
    const obtenerAlertasVencimientoCheques = useCallback(async (dias = 5) => {
        return makeRequest(`${API_BASE}/cheques/alertas-vencimiento/?dias=${dias}`);
    }, [makeRequest]);

    /**
     * Crea un cheque desde caja (caja general o cambio de cheque).
     * Requiere caja abierta.
     * @param {object} datosCheque - numero, banco_emisor, monto, cuit_librador, fecha_emision, fecha_presentacion, origen_tipo (CAJA_GENERAL | CAMBIO_CHEQUE), origen_descripcion (opc), origen_cliente_id (opc), monto_efectivo_entregado (si CAMBIO_CHEQUE), comision_cambio (opc)
     * @returns {Promise<object>} - Cheque creado
     */
    const crearChequeCaja = useCallback(async (datosCheque) => {
        return makeRequest(`${API_BASE}/cheques/`, {
            method: 'POST',
            body: JSON.stringify(datosCheque),
        });
    }, [makeRequest]);

    /**
     * Valida un CUIT usando el endpoint de validación.
     * @param {string} cuit - CUIT a validar
     * @returns {Promise<object>} - Resultado de la validación
     */
    const validarCUIT = useCallback(async (cuit) => {
        return makeRequest(`/api/clientes/validar-cuit/?cuit=${encodeURIComponent(cuit)}`);
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

        // Cuentas banco
        obtenerCuentasBanco,

        // Cheques
        obtenerCheques,
        depositarCheque,
        endosarCheques,
        marcarChequeRechazado,
        reactivarCheque,
        acreditarCheque,
        obtenerDetalleCheque,
        editarCheque,
        obtenerAlertasVencimientoCheques,
        crearChequeCaja,
        validarCUIT,
    };
}

export default useCajaAPI;
