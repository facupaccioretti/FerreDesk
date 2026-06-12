import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const HOSTS_PUBLICOS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function esHostTenantValido(hostname) {
    if (!hostname) {
        return false;
    }

    const hostnameNormalizado = hostname.toLowerCase();
    if (HOSTS_PUBLICOS.has(hostnameNormalizado)) {
        return false;
    }

    if (
        hostnameNormalizado.endsWith(".localhost") ||
        hostnameNormalizado.endsWith(".lvh.me")
    ) {
        return true;
    }

    return hostnameNormalizado.split(".").length >= 3;
}

/**
 * Protege rutas tenant distinguiendo autenticacion y setup minimo.
 */
export default function RutaPrivada({
    children,
    hostnameActual = window.location.hostname,
}) {
    const [estadoAcceso, setEstadoAcceso] = useState({
        cargando: true,
        estaAutenticado: false,
        setupCompleto: false,
        hostTenantValido: true,
    });
    const location = useLocation();

    useEffect(() => {
        let activo = true;

        const verificarEstado = async () => {
            if (!esHostTenantValido(hostnameActual)) {
                if (activo) {
                    setEstadoAcceso({
                        cargando: false,
                        estaAutenticado: false,
                        setupCompleto: false,
                        hostTenantValido: false,
                    });
                }
                return;
            }

            try {
                const respuestaUsuario = await fetch("/api/user/", {
                    credentials: "include",
                });
                if (respuestaUsuario.status !== 200) {
                    throw new Error("No autenticado");
                }

                const respuestaSetup = await fetch("/api/ferreteria/estado-setup/", {
                    credentials: "include",
                });
                if (!respuestaSetup.ok) {
                    throw new Error("No se pudo resolver el estado de setup");
                }

                const datosSetup = await respuestaSetup.json();
                if (activo) {
                    setEstadoAcceso({
                        cargando: false,
                        estaAutenticado: true,
                        setupCompleto: datosSetup.setup_completo === true,
                        hostTenantValido: true,
                    });
                }
            } catch (error) {
                if (activo) {
                    setEstadoAcceso({
                        cargando: false,
                        estaAutenticado: false,
                        setupCompleto: false,
                        hostTenantValido: true,
                    });
                }
            }
        };

        verificarEstado();

        return () => {
            activo = false;
        };
    }, [hostnameActual]);

    if (estadoAcceso.cargando) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    if (!estadoAcceso.hostTenantValido) {
        return <Navigate to="/" replace />;
    }

    if (!estadoAcceso.estaAutenticado) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (!estadoAcceso.setupCompleto && location.pathname !== "/setup") {
        return <Navigate to="/setup" replace />;
    }

    if (estadoAcceso.setupCompleto && location.pathname === "/setup") {
        return <Navigate to="/home" replace />;
    }

    return children;
}
