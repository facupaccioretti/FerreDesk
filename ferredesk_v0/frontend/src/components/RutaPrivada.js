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

// TLDs de dos niveles (country-code second-level domains).
// Necesarios para distinguir correctamente el dominio base del subdominio tenant.
// Ej: en "ferredesk.com.ar", "com.ar" es el TLD → "ferredesk" es el dominio, no un tenant.
const TLDS_DOS_NIVELES = new Set([
    "com.ar", "com.br", "com.mx", "com.co", "com.uy", "com.py", "com.pe",
    "com.cl", "com.ve", "com.ec", "com.bo",
    "co.uk", "co.nz", "co.za", "co.jp", "co.kr",
    "com.au", "com.sg", "com.hk",
    "org.ar", "org.br", "org.uk",
    "net.ar", "net.br", "net.au",
    "gob.ar", "gov.br", "gov.uk", "gov.au",
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

    // Determinar cuántas partes ocupa el TLD (1 para .com/.xyz, 2 para .com.ar/.co.uk)
    let partesTld = 1;
    if (partes.length >= 2) {
        const ultimosDos = partes.slice(-2).join(".");
        if (TLDS_DOS_NIVELES.has(ultimosDos)) {
            partesTld = 2;
        }
    }

    // Mínimo de partes para ser tenant: TLD + dominio + subdominio
    // Ej .xyz:    1 + 1 + 1 = 3 → "tenant.ferredesk.xyz"
    // Ej .com.ar: 2 + 1 + 1 = 4 → "tenant.ferredesk.com.ar"
    const minPartes = partesTld + 2;
    if (partes.length < minPartes) {
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
