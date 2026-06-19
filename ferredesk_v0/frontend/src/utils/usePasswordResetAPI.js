import { getCookie } from "./csrf";

async function asegurarCsrfLocal() {
  let csrfToken = getCookie("csrftoken");
  if (!csrfToken) {
    await fetch("/api/csrf/", { credentials: "include" });
    csrfToken = getCookie("csrftoken");
  }
  return csrfToken;
}

export function usePasswordResetAPI() {
  const solicitarResetPublico = async ({ email }) => {
    const csrfToken = await asegurarCsrfLocal();
    const response = await fetch("/api/public/acceso/password-reset/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "No se pudo iniciar el reset de contrasena.");
    }
    return data;
  };

  const confirmarResetTenant = async ({ uid, token, newPassword1, newPassword2 }) => {
    const csrfToken = await asegurarCsrfLocal();
    const response = await fetch("/api/auth/password-reset/confirm/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({
        uid,
        token,
        new_password1: newPassword1,
        new_password2: newPassword2,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errores = data?.new_password2 || data?.new_password1 || data?.token;
      if (Array.isArray(errores) && errores.length > 0) {
        throw new Error(errores[0]);
      }
      throw new Error(data.message || "No se pudo actualizar la contrasena.");
    }
    return data;
  };

  return {
    solicitarResetPublico,
    confirmarResetTenant,
  };
}
