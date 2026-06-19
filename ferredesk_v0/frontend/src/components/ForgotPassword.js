import React from "react";
import { Link } from "react-router-dom";

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

export default function ForgotPassword() {
  const theme = useFerreDeskTheme();
  const { solicitarResetPublico } = usePasswordResetAPI();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const hostname = window.location.hostname;
  const isPublicDomain = !esHostTenantValido(hostname);

  React.useEffect(() => {
    if (!isPublicDomain) {
      window.location.assign(`${resolverBasePublica(hostname)}/forgot-password`);
    }
  }, [hostname, isPublicDomain]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(event.target);
    const email = formData.get("email")?.toString().trim() || "";

    try {
      const data = await solicitarResetPublico({ email });
      setSuccess(data.message);
      event.target.reset();
    } catch (err) {
      setError(err.message || "No se pudo iniciar el reset.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPublicDomain) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className={`${theme.tarjetaClara} max-w-md w-full rounded-2xl shadow-xl p-8`}>
        <h1 className="text-3xl font-bold text-orange-600 mb-3">Recuperar contrasena</h1>
        <p className="text-slate-600 mb-6">
          Ingresa el correo con el que accedes a FerreDesk. Si existe, enviaremos un enlace al tenant correcto.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo de acceso
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="admin@ejemplo.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-sm font-medium text-white ${theme.botonManager} disabled:opacity-50`}
          >
            {loading ? "Enviando..." : "Enviar enlace de recuperacion"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className={`text-sm font-medium ${theme.azulSecundario}`}>
            Volver al acceso central
          </Link>
        </div>
      </div>
    </div>
  );
}
