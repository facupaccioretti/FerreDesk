import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Componente que protege las rutas de la aplicación.
 * Verifica la autenticación del usuario y si la ferretería está configurada.
 */
export default function RutaPrivada({ children }) {
    const [cargando, setCargando] = useState(true);
    const [estaAutenticado, setEstaAutenticado] = useState(false);
    const [estaConfigurado, setEstaConfigurado] = useState(true);
    const navegar = useNavigate();

    useEffect(() => {
        const verificarEstado = async () => {
            try {
                // 1. Verificar Autenticación del Usuario
                const respuestaUsuario = await fetch("/api/user/", { credentials: "include" });
                if (respuestaUsuario.status !== 200) throw new Error("No autenticado");
                setEstaAutenticado(true);

                // 2. Verificar Configuración del Negocio
                const respuestaFerreteria = await fetch("/api/ferreteria/", { credentials: "include" });
                if (respuestaFerreteria.ok) {
                    const datosFerreteria = await respuestaFerreteria.json();
                    if (datosFerreteria.no_configurada === true) {
                        setEstaConfigurado(false);
                        // Si el sistema no está configurado, forzar redirección al asistente
                        if (window.location.pathname !== '/setup') {
                            navegar("/setup");
                        }
                    } else {
                        setEstaConfigurado(true);
                    }
                }
            } catch (error) {
                setEstaAutenticado(false);
                navegar("/login/");
            } finally {
                setCargando(false);
            }
        };

        verificarEstado();
    }, [navegar]);

    if (cargando) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
    );

    if (!estaAutenticado) return null;

    // Bloquear acceso a rutas protegidas si falta configuración inicial
    if (!estaConfigurado && window.location.pathname !== '/setup') return null;

    return children;
}
