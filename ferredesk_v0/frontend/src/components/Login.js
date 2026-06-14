import React from "react";
import { useNavigate } from "react-router-dom";

import { useFerreDeskTheme } from "../hooks/useFerreDeskTheme";
import { esHostTenantValido } from "./RutaPrivada";
import { getCookie } from "../utils/csrf";

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
    // Si termina en .localhost o .lvh.me, sabemos que el base domain tiene 2 partes
    if (hostnameNormalizado.endsWith(".localhost") || hostnameNormalizado.endsWith(".lvh.me")) {
      return `${window.location.protocol}//${partes.slice(-2).join(".")}${portStr}`;
    }
    // Para dominios reales (ej: mi-negocio.ferredesk.com -> ferredesk.com)
    return `${window.location.protocol}//${partes.slice(1).join(".")}${portStr}`;
  }

  return `${window.location.protocol}//${hostnameNormalizado}${portStr}`;
}

function redirigirA(url) {
  window.location.assign(url);
}

function Login() {
  const theme = useFerreDeskTheme();
  const navigate = useNavigate();
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const hostname = window.location.hostname;
  const isPublicDomain = !esHostTenantValido(hostname);

  React.useEffect(() => {
    if (!isPublicDomain) {
      redirigirA(`${resolverBasePublica(hostname)}/`);
    }
  }, [isPublicDomain, hostname]);



  const loginTenantDirecto = React.useCallback(async ({ username, password }) => {
    let csrftoken = getCookie("csrftoken");
    if (!csrftoken) {
      await fetch("/api/csrf/");
      csrftoken = getCookie("csrftoken");
    }

    const response = await fetch("/api/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      redirigirA("/home");
      return;
    }

    let message = data.message || "Error al iniciar sesión.";
    message +=
      " Por favor, verifica tus credenciales y asegúrate de estar ingresando al subdominio correcto de tu negocio.";
    throw new Error(message);
  }, []);

  const loginPublicoConBridge = React.useCallback(async ({ email, password }) => {
    let csrftoken = getCookie("csrftoken");
    if (!csrftoken) {
      await fetch("/api/csrf/");
      csrftoken = getCookie("csrftoken");
    }

    const response = await fetch("/api/public/acceso/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "No se pudo autenticar la cuenta global.");
    }

    let tenantUrl = data?.tenant?.url;
    const tokenPuente = data?.token_puente?.token;
    
    if (!tenantUrl || !tokenPuente) {
      throw new Error(
        "La respuesta del login público no incluye el tenant o el token puente requerido."
      );
    }

    // Fix for local development: if we are running on port 3000, append it to the tenant url
    if (window.location.port) {
      const parsedUrl = new URL(tenantUrl);
      parsedUrl.port = window.location.port;
      tenantUrl = parsedUrl.toString();
    }

    const bridgeUrl = new URL("/api/login-bridge/", tenantUrl);
    bridgeUrl.searchParams.set("token", tokenPuente);
    redirigirA(bridgeUrl.toString());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.target);
    const username = formData.get("username")?.toString().trim() || "";
    const password = formData.get("password")?.toString() || "";

    try {
      if (isPublicDomain) {
        await loginPublicoConBridge({ email: username, password });
      } else {
        await loginTenantDirecto({ username, password });
      }
    } catch (err) {
      setError(err.message || "Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPublicDomain) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-orange-600 mb-2">
              {isPublicDomain ? "Acceso Central FerreDesk" : "Acceso al Negocio"}
            </h2>
            <p className="text-slate-600 mb-2">
              {isPublicDomain
                ? "Ingresa con tu cuenta global y te enviaremos automáticamente a tu negocio."
                : "Ingresa con tus credenciales del tenant para operar tu negocio."}
            </p>
            {!isPublicDomain && (
              <div className="inline-block bg-white/50 px-4 py-1 rounded-full text-sm font-medium text-slate-700 shadow-sm border border-slate-200">
                Subdominio activo: <span className="text-orange-600">{hostname}</span>
              </div>
            )}
            {isPublicDomain && (
              <div className="mt-2 bg-blue-50 border border-blue-200 text-blue-900 text-sm px-4 py-2 rounded-lg text-left shadow-sm">
                <strong>Acceso unificado:</strong> inicia sesión aquí con tu cuenta global.
                Si las credenciales son válidas, FerreDesk abrirá tu sesión en el tenant correcto sin pedirte recordar el subdominio.
              </div>
            )}
          </div>

          <div className={`${theme.tarjetaClara} p-8 rounded-2xl shadow-xl`}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 transform transition-all duration-300 ease-in-out">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                  {isPublicDomain ? "Correo de acceso" : "Usuario o Correo"}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="admin@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="Ingrese su contraseña"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${theme.botonManager} disabled:opacity-50`}
              >
                {loading
                  ? "Verificando..."
                  : isPublicDomain
                    ? "Ingresar y abrir mi negocio"
                    : "Ingresar a mi Negocio"}
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                ¿Aún no tienes tu espacio de trabajo?{" "}
                <br className="sm:hidden" />
                <button
                  onClick={() => {
                    if (!isPublicDomain) {
                      redirigirA(`${resolverBasePublica(hostname)}/register`);
                    } else {
                      navigate("/register");
                    }
                  }}
                  className={`font-medium ${theme.azulSecundario} hover:text-blue-500 mt-1 inline-block`}
                >
                  Registrar un nuevo Negocio SaaS
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
