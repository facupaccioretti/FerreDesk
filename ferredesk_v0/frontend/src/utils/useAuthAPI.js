import { useCallback } from "react";

import { getCookie } from "./csrf";

async function asegurarCsrfLocal() {
  let csrfToken = getCookie("csrftoken");
  if (!csrfToken) {
    await fetch("/api/csrf/", { credentials: "include" });
    csrfToken = getCookie("csrftoken");
  }
  return csrfToken;
}

function normalizarTenantUrl(tenantUrl) {
  const url = new URL(tenantUrl);
  if (window.location.port) {
    url.port = window.location.port;
  }
  return url.toString();
}



export function useAuthAPI() {
  const loginTenantDirecto = useCallback(async ({ username, password }) => {
    const csrfToken = await asegurarCsrfLocal();
    const response = await fetch("/api/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (response.ok) {
      return { redirectTo: "/home" };
    }

    let message = data.message || "Error al iniciar sesion.";
    message +=
      " Por favor, verifica tus credenciales y asegurate de estar ingresando al subdominio correcto de tu negocio.";
    throw new Error(message);
  }, []);

  const loginPublicoConBridge = useCallback(async ({ email, password }) => {
    const csrfToken = await asegurarCsrfLocal();
    const response = await fetch("/api/public/acceso/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "No se pudo autenticar la cuenta global.");
    }

    const tenantUrlOriginal = data?.tenant?.url;
    const tokenPuente = data?.token_puente?.token;
    if (!tenantUrlOriginal || !tokenPuente) {
      throw new Error(
        "La respuesta del login publico no incluye el tenant o el token puente requerido."
      );
    }

    const tenantUrl = normalizarTenantUrl(tenantUrlOriginal);
    
    const form = document.createElement("form");
    form.method = "POST";
    form.action = new URL("/api/login-bridge/", tenantUrl).toString();

    const tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = "token";
    tokenInput.value = tokenPuente;

    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();

    // Promesa pendiente; la recarga navegara hacia el tenant
    return new Promise(() => {});
  }, []);

  return {
    loginTenantDirecto,
    loginPublicoConBridge,
  };
}
