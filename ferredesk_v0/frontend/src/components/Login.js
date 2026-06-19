import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useAuthAPI } from "../utils/useAuthAPI";
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

function redirigirA(url) {
  window.location.assign(url);
}

function Login() {
  const navigate = useNavigate();
  const { loginTenantDirecto, loginPublicoConBridge } = useAuthAPI();
  const [error, setError] = React.useState("");
  const [errorCode, setErrorCode] = React.useState("");
  const [ultimoEmailIntentado, setUltimoEmailIntentado] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const hostname = window.location.hostname;
  const isPublicDomain = !esHostTenantValido(hostname);

  React.useEffect(() => {
    if (!isPublicDomain) {
      redirigirA(`${resolverBasePublica(hostname)}/`);
    }
  }, [isPublicDomain, hostname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setLoading(true);

    const formData = new FormData(e.target);
    const username = formData.get("username")?.toString().trim() || "";
    const password = formData.get("password")?.toString() || "";
    setUltimoEmailIntentado(username);

    try {
      if (isPublicDomain) {
        await loginPublicoConBridge({ email: username, password });
      } else {
        const resultado = await loginTenantDirecto({ username, password });
        redirigirA(resultado.redirectTo);
      }
    } catch (err) {
      setErrorCode(err.errorCode || "");
      setError(err.message || "Error de conexion con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPublicDomain) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 relative flex flex-col font-sans">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(71, 85, 105, 0.15) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/20 via-transparent to-slate-100/30 pointer-events-none"></div>

      <nav className="relative z-10 px-6 md:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md">
            FD
          </div>
          <span className="text-lg font-bold text-slate-800">
            <span className="text-orange-600">Ferre</span>Desk
          </span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </button>
      </nav>

      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1.5">Ingresá a tu cuenta</h2>
            <p className="text-xs text-slate-500 leading-normal">Colocá tus datos para ingresar al sistema.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-xs font-medium text-red-600 transform transition-all duration-300 ease-in-out">
                <div>{error}</div>
                {isPublicDomain && errorCode === "pending_verification" && ultimoEmailIntentado && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/pendiente-verificacion?email=${encodeURIComponent(
                            ultimoEmailIntentado
                          )}&emailEnviado=false&origen=login`
                        )
                      }
                      className="font-semibold text-orange-600 hover:underline"
                    >
                      Ir a la pantalla de verificacion
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="username"
                name="username"
                type="email"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                placeholder="admin@ejemplo.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  Olvidé mi contraseña
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl shadow-lg hover:shadow-xl active:scale-[0.99] text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {loading ? "Ingresando..." : "Ingresar →"}
            </button>
          </form>

          <div className="text-center mt-5 text-xs text-slate-500">
            ¿Aún no tenés tu espacio?{" "}
            <button
              onClick={() => {
                if (!isPublicDomain) {
                  redirigirA(`${resolverBasePublica(hostname)}/register`);
                } else {
                  navigate("/register");
                }
              }}
              className="font-semibold text-orange-600 hover:underline"
            >
              Registrar nuevo negocio
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
