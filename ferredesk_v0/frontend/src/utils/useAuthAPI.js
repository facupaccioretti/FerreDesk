import { useCallback } from "react";

import { getCookie } from "./csrf";

async function asegurarCsrfLocal() {
  let csrfToken = getCookie("csrftoken");
  if (!csrfToken) {
    const response = await fetch("/api/csrf/", { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    csrfToken = data.csrfToken || getCookie("csrftoken");
  }
  return csrfToken;
}

function crearHeadersJson(csrfToken) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return headers;
}

async function leerRespuestaApi(response, mensajeFallback) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const texto = await response.text().catch(() => "");
  const error = new Error(mensajeFallback);
  error.status = response.status;
  error.responseText = texto;
  throw error;
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
      headers: crearHeadersJson(csrfToken),
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await leerRespuestaApi(
      response,
      "El servidor no devolvio una respuesta valida al iniciar sesion."
    );
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
      headers: crearHeadersJson(csrfToken),
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await leerRespuestaApi(
      response,
      "No pudimos iniciar sesion por un error del servidor. Intenta nuevamente o contacta soporte."
    );
    if (!response.ok) {
      const error = new Error(data.message || "No se pudo autenticar la cuenta global.");
      error.errorCode = data.error_code || "";
      throw error;
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
