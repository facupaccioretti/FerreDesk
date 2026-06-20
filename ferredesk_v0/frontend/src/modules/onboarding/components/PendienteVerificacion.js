import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

import useOnboardingVerificationAPI from "../../../utils/useOnboardingVerificationAPI";

const PendienteVerificacion = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reenviarEmail } = useOnboardingVerificationAPI();
  const email = searchParams.get("email") || "";
  const emailEnviado = searchParams.get("emailEnviado") !== "false";
  const requiereReenvio = searchParams.get("requiereReenvio") === "true";
  const solicitudId = searchParams.get("solicitudId") || "";
  const origen = searchParams.get("origen") || "registro";

  const [reenviando, setReenviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [mensajeError, setMensajeError] = useState("");

  const handleReenviar = async () => {
    if (!email) {
      setMensajeError("No se proporciono un correo valido.");
      return;
    }

    setReenviando(true);
    setMensajeExito("");
    setMensajeError("");

    try {
      await reenviarEmail(email);
      setMensajeExito("Si la cuenta sigue pendiente, enviamos un nuevo enlace de verificacion.");
    } catch (error) {
      setMensajeError(error.message || "Error al intentar reenviar el correo.");
    } finally {
      setReenviando(false);
    }
  };

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
          <div className="mb-6 text-center">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1.5">Verificá tu correo</h2>
            <p className="text-xs text-slate-500 leading-normal">
              {origen === "login"
                ? "Tu cuenta existe, pero requiere verificación por correo electrónico para ser habilitada."
                : "Tu cuenta fue creada exitosamente. Para comenzar a usar FerreDesk, necesitás verificar tu dirección de correo."}
            </p>
          </div>

          {email && (
            <div className="text-center py-2.5 px-3 bg-slate-50 border border-slate-100 rounded-lg mb-5">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider mb-0.5">Correo registrado</span>
              <span className="text-sm font-semibold text-slate-700">{email}</span>
              {solicitudId && (
                <span className="text-[10px] text-slate-400 block mt-0.5">Solicitud #{solicitudId}</span>
              )}
            </div>
          )}

          {/* Estado / Mensajes */}
          {(() => {
            if (mensajeExito) {
              return (
                <div className="rounded-lg bg-green-50 p-3 text-xs font-medium text-green-700 mb-5 text-center border border-green-100">
                  {mensajeExito}
                </div>
              );
            }
            if (mensajeError) {
              return (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 mb-5 text-center border border-red-100">
                  {mensajeError}
                </div>
              );
            }
            if (emailEnviado) {
              return (
                <div className="rounded-lg bg-green-50 p-3 text-xs font-medium text-green-700 mb-5 text-center border border-green-100">
                  Te enviamos un enlace de verificación. Revisá tu bandeja principal y spam.
                </div>
              );
            } else {
              return (
                <div className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800 mb-5 text-center border border-amber-100">
                  La cuenta se creó, pero el correo no pudo enviarse automáticamente. Solicitá un nuevo enlace abajo.
                </div>
              );
            }
          })()}

          {requiereReenvio && !mensajeExito && !mensajeError && (
            <p className="text-[11px] text-slate-400 text-center mb-5 leading-normal">
              Mientras la cuenta siga pendiente, no vas a poder ingresar desde el login central.
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl shadow-lg hover:shadow-xl active:scale-[0.99] text-sm font-semibold transition-all duration-150"
            >
              Ir al login →
            </button>

            <button
              onClick={handleReenviar}
              disabled={reenviando}
              className="w-full py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {reenviando ? "Reenviando..." : "Reenviar enlace de verificación"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PendienteVerificacion;
