import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionUserQuery } from "../domains/session/useSessionUserQuery";
import { useSetupStatusQuery } from "../domains/setup/useSetupStatusQuery";
import AppShell from "../layouts/AppShell";

const HOSTS_PUBLICOS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SUBDOMINIOS_PUBLICOS_RESERVADOS = new Set([
    "www",
    "staging",
    "dev",
    "test",
    "demo",
    "sandbox",
    "beta",
    "alpha",
    "prod",
    "production",
    "qa",
    "uat",
    "preview",
]);

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

    const partes = hostnameNormalizado.split(".");
    if (partes.length < 3) {
        return false;
    }

    return !SUBDOMINIOS_PUBLICOS_RESERVADOS.has(partes[0]);
}

/**
 * Protege rutas tenant distinguiendo autenticacion y setup minimo.
 */
export default function RutaPrivada({
    children,
    hostnameActual = window.location.hostname,
    permitirSetupIncompleto = false,
}) {
    const {
        isLoading: cargandoSesion,
        isAuthenticated,
    } = useSessionUserQuery();
    const {
        isLoading: cargandoSetup,
        setupCompleto,
    } = useSetupStatusQuery({
        enabled: esHostTenantValido(hostnameActual) && isAuthenticated,
    });
    const location = useLocation();
    const hostTenantValido = esHostTenantValido(hostnameActual)
    const cargando = hostTenantValido && (cargandoSesion || (isAuthenticated && cargandoSetup))

    if (cargando) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    if (!hostTenantValido) {
        return <Navigate to="/" replace />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (
        !setupCompleto &&
        !permitirSetupIncompleto &&
        location.pathname !== "/setup"
    ) {
        return <Navigate to="/setup" replace />;
    }

    if (setupCompleto && location.pathname === "/setup") {
        return <Navigate to="/home" replace />;
    }

    return <AppShell>{children}</AppShell>;
}
