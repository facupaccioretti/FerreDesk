import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useRegistroTenantAPI } from "../../../utils/useRegistroTenantAPI";

const Register = () => {
  const navigate = useNavigate();

  const {
    formData,
    handleChange,
    handleValidateSlug,
    handleSubmit,
    loadingSlug,
    slugResult,
    slugError,
    loadingRegistro,
    registroResult,
    registroError,
    localError,
  } = useRegistroTenantAPI();

  React.useEffect(() => {
    if (!registroResult) {
      return;
    }

    const emailEnviado = registroResult?.email_verificacion?.enviado ? "true" : "false";
    const requiereReenvio = registroResult?.email_verificacion?.requiere_reenvio ? "true" : "false";
    const solicitudId = registroResult?.solicitud_id || "";

    navigate(
      `/pendiente-verificacion?email=${encodeURIComponent(
        formData.email_admin
      )}&emailEnviado=${emailEnviado}&requiereReenvio=${requiereReenvio}&solicitudId=${solicitudId}`
    );
  }, [registroResult, navigate, formData.email_admin]);

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

      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[460px] bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xl">

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1.5">Registrá tu negocio</h2>
            <p className="text-xs text-slate-500 leading-normal">En unos minutos tenés tu sistema listo para usar.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {(localError || registroError) && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative text-xs font-medium"
                role="alert"
              >
                <span>{localError || registroError}</span>
              </div>
            )}

            <div>
              <label htmlFor="nombre" className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del negocio
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                placeholder="Ferretería Don Carlos"
                value={formData.nombre}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección web de tu negocio
              </label>
              <div className="flex">
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  className="flex-1 px-3 py-2 rounded-l-lg border border-slate-300 border-r-0 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                  placeholder="don-carlos"
                  value={formData.slug}
                  onChange={handleChange}
                  onBlur={handleValidateSlug}
                />
                <button
                  type="button"
                  onClick={handleValidateSlug}
                  disabled={loadingSlug}
                  className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-r-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {loadingSlug ? "Validando..." : "Verificar"}
                </button>
              </div>
              <div className="mt-1 text-xs min-h-[16px]">
                {loadingSlug && (
                  <span className="text-blue-500 font-medium">Comprobando disponibilidad...</span>
                )}
                {!loadingSlug && slugError && (
                  <span className="text-red-500 font-medium">{slugError}</span>
                )}
                {!loadingSlug && slugResult?.disponible && formData.slug === slugResult.slug && (
                  <span className="text-green-600 font-medium">
                    Subdominio disponible. ({slugResult.dominio_sugerido})
                  </span>
                )}
                {!loadingSlug && !slugError && (!slugResult || formData.slug !== slugResult.slug) && (
                  <span className="text-slate-400">
                    Tu sistema quedará en <strong>{formData.slug || "tu-negocio"}.ferredesk.com</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-[1px] bg-slate-100"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tu cuenta de administrador</span>
              <div className="flex-1 h-[1px] bg-slate-100"></div>
            </div>

            <div>
              <label
                htmlFor="email_admin"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Correo electrónico
              </label>
              <input
                id="email_admin"
                name="email_admin"
                type="email"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                placeholder="admin@ejemplo.com"
                value={formData.email_admin}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Confirmar
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors bg-white"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingRegistro || loadingSlug}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl shadow-lg hover:shadow-xl active:scale-[0.99] text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {loadingRegistro ? "Creando negocio..." : "Crear mi negocio →"}
            </button>
          </form>

          <div className="text-center mt-5 text-xs text-slate-500">
            ¿Ya tenés cuenta?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-semibold text-orange-600 hover:underline"
            >
              Ingresar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
