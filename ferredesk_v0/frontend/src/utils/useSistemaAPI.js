/**
 * Hook para interactuar con servicios generales de infraestructura del sistema.
 */

import { useState, useCallback } from 'react';
import { getCookie } from './csrf';

const API_BASE = '/api/sistema';

export function useSistemaAPI() {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);

    const realizarSolicitud = useCallback(async (url, opciones = {}) => {
        setCargando(true);
        setError(null);

        try {
            const respuesta = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                    ...opciones.headers,
                },
                credentials: 'include',
                ...opciones,
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                const mensajeError = datos.detail || datos.error || 'Error en la operación';
                const errorObj = new Error(mensajeError);
                errorObj.status = respuesta.status;
                throw errorObj;
            }

            return datos;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setCargando(false);
        }
    }, []);

    /**
     * Consultamos el progreso actual del respaldo SQL para notificar al usuario.
     */
    const obtenerEstadoBackup = useCallback(async () => {
        return realizarSolicitud(`${API_BASE}/backup/estado/`);
    }, [realizarSolicitud]);

    return {
        cargando,
        error,
        obtenerEstadoBackup,
    };
}

export default useSistemaAPI;
