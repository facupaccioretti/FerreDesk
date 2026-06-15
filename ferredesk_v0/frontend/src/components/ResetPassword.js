import React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme";
import { usePasswordResetAPI } from "../utils/usePasswordResetAPI";
import { esHostTenantValido } from "./RutaPrivada";

function resolverBasePublica(hostname) {
  const hostnameNormalizado = (hostname || "").toLowerCase();

  if (
    hostnameNormalizado === "localhost" ||
    hostnameNormalizado === "127.0.0.1" ||
    hostnameNormalizado === "::1" ||
    hostnameNormalizado === "[::1]"
  ) {
    return "http://localhost:3000";
  }

  if (hostnameNormalizado === "lvh.me") {
    return "http://lvh.me:3000";
  }

  const portStr = window.location.port ? `:${window.location.port}` : "";
  const partes = hostnameNormalizado.split(".");
  if (partes.length >= 3) {
    if (hostnameNormalizado.endsWith(".localhost") || hostnameNormalizado.endsWith(".lvh.me")) {
      return `${window.location.protocol}//${partes.slice(-2).join(".")}${portStr}`;
    }
    return `${window.location.protocol}//${partes.slice(1).join(".")}${portStr}`;
  }

  return `${window.location.protocol}//${hostnameNormalizado}${portStr}`;
}

export default function ResetPassword() {
  const theme = useFerreDeskTheme();
  const { confirmarResetTenant } = usePasswordResetAPI();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const hostname = window.location.hostname;
  const isTenantDomain = esHostTenantValido(hostname);
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(event.target);
    const newPassword1 = formData.get("newPassword1")?.toString() || "";
    const newPassword2 = formData.get("newPassword2")?.toString() || "";

    try {
      const data = await confirmarResetTenant({
        uid,
        token,
        newPassword1,
        newPassword2,
      });
      setSuccess(data.message);
      event.target.reset();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la contrasena.");
    } finally {
      setLoading(false);
    }
  };

  if (!isTenantDomain) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className={`${theme.tarjetaClara} max-w-md w-full rounded-2xl shadow-xl p-8`}>
          <h1 className="text-2xl font-bold text-orange-600 mb-3">Enlace invalido</h1>
          <p className="text-slate-600 mb-6">
            Este enlace debe abrirse desde el subdominio de tu negocio.
          </p>
          <a href={`${resolverBasePublica(hostname)}/forgot-password`} className={`text-sm font-medium ${theme.azulSecundario}`}>
            Solicitar un nuevo enlace
          </a>
        </div>
      </div>
    );
  }

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className={`${theme.tarjetaClara} max-w-md w-full rounded-2xl shadow-xl p-8`}>
          <h1 className="text-2xl font-bold text-orange-600 mb-3">Faltan datos del enlace</h1>
          <p className="text-slate-600 mb-6">
            El enlace de recuperacion no incluye el token necesario.
          </p>
          <a href={`${resolverBasePublica(hostname)}/forgot-password`} className={`text-sm font-medium ${theme.azulSecundario}`}>
            Solicitar un nuevo enlace
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className={`${theme.tarjetaClara} max-w-md w-full rounded-2xl shadow-xl p-8`}>
        <h1 className="text-3xl font-bold text-orange-600 mb-3">Nueva contrasena</h1>
        <p className="text-slate-600 mb-6">
          Define una nueva contrasena para tu cuenta. Tambien sincronizaremos el acceso central.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}

          <div className="space-y-2">
            <label htmlFor="newPassword1" className="block text-sm font-medium text-slate-700">
              Nueva contrasena
            </label>
            <input
              id="newPassword1"
              name="newPassword1"
              type="password"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword2" className="block text-sm font-medium text-slate-700">
              Repite la nueva contrasena
            </label>
            <input
              id="newPassword2"
              name="newPassword2"
              type="password"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-sm font-medium text-white ${theme.botonManager} disabled:opacity-50`}
          >
            {loading ? "Actualizando..." : "Guardar nueva contrasena"}
          </button>
        </form>

        {success && (
          <div className="mt-6 text-center">
            <a href={`${resolverBasePublica(hostname)}/login`} className={`text-sm font-medium ${theme.azulSecundario}`}>
              Ir al acceso central
            </a>
          </div>
        )}

        {!success && (
          <div className="mt-6 text-center">
            <Link to="/" className={`text-sm font-medium ${theme.azulSecundario}`}>
              Volver al inicio del tenant
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
