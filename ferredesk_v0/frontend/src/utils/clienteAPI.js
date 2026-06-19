let tokenCSRFCached = null;
let fetchConCSRFInstalado = false;

const METODOS_MUTANTES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function esFormData(valor) {
  return typeof FormData !== "undefined" && valor instanceof FormData;
}

function esBlob(valor) {
  return typeof Blob !== "undefined" && valor instanceof Blob;
}

function esObjetoPlano(valor) {
  return (
    valor !== null &&
    typeof valor === "object" &&
    !esFormData(valor) &&
    !esBlob(valor) &&
    !(valor instanceof URLSearchParams)
  );
}

function obtenerPrimerMensaje(datos) {
  if (!datos || typeof datos !== "object") return null;

  const mensajeDirecto = datos.detail || datos.message || datos.error;
  if (typeof mensajeDirecto === "string") return mensajeDirecto;

  for (const [clave, valor] of Object.entries(datos)) {
    if (clave.startsWith("_")) continue;
    if (Array.isArray(valor) && valor.length > 0) return String(valor[0]);
    if (typeof valor === "string") return valor;
  }

  return null;
}

export function invalidarTokenCSRF() {
  tokenCSRFCached = null;
}

export function esMetodoMutante(metodo = "GET") {
  return METODOS_MUTANTES.has(String(metodo || "GET").toUpperCase());
}

export async function obtenerTokenCSRF({ forzar = false } = {}) {
  if (tokenCSRFCached && !forzar) {
    return tokenCSRFCached;
  }

  const respuesta = await fetch("/api/csrf/", {
    method: "GET",
    credentials: "include",
  });

  const datos = await leerRespuestaAPI(respuesta);

  if (!respuesta.ok || !datos?.csrfToken) {
    throw new Error("No pudimos preparar la sesion segura. Actualiza la pagina e intenta nuevamente.");
  }

  tokenCSRFCached = datos.csrfToken;
  return tokenCSRFCached;
}

export async function leerRespuestaAPI(respuesta) {
  if (respuesta.status === 204) {
    return null;
  }

  const tipoContenido = respuesta.headers?.get?.("content-type") || "";

  if (tipoContenido.includes("application/json")) {
    try {
      return await respuesta.json();
    } catch (error) {
      return {
        _tipo: "json_invalido",
        texto: "",
      };
    }
  }

  const texto = await respuesta.text().catch(() => "");
  return {
    _tipo: "no_json",
    texto,
  };
}

export function normalizarErrorAPI(respuesta, datos) {
  if (datos?._tipo === "no_json" || datos?._tipo === "json_invalido") {
    if (respuesta.status >= 500) {
      return "El servidor tuvo un error interno. Intenta nuevamente o contacta soporte si persiste.";
    }
    return `El servidor no devolvio una respuesta valida. Codigo ${respuesta.status}.`;
  }

  const mensaje = obtenerPrimerMensaje(datos);

  if (respuesta.status === 403 && mensaje && mensaje.toLowerCase().includes("csrf")) {
    return "No pudimos validar la sesion. Actualiza la pagina e intenta nuevamente.";
  }

  if (mensaje) {
    return mensaje;
  }

  return respuesta.statusText || `Error de API (${respuesta.status})`;
}

export async function clienteAPI(url, opciones = {}) {
  const metodo = String(opciones.method || "GET").toUpperCase();
  const headers = new Headers(opciones.headers || {});
  const opcionesFetch = {
    ...opciones,
    method: metodo,
    credentials: "include",
    headers,
  };

  if (Object.prototype.hasOwnProperty.call(opciones, "body")) {
    if (esFormData(opciones.body)) {
      headers.delete("Content-Type");
      opcionesFetch.body = opciones.body;
    } else if (esObjetoPlano(opciones.body)) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      opcionesFetch.body = JSON.stringify(opciones.body);
    }
  }

  if (esMetodoMutante(metodo)) {
    const tokenCSRF = await obtenerTokenCSRF();
    headers.set("X-CSRFToken", tokenCSRF);
  }

  const respuesta = await fetch(url, opcionesFetch);
  const datos = await leerRespuestaAPI(respuesta);

  if (!respuesta.ok) {
    const error = new Error(normalizarErrorAPI(respuesta, datos));
    error.status = respuesta.status;
    error.datos = datos;
    throw error;
  }

  return datos;
}

function obtenerMetodoRequest(input, opciones) {
  return String(opciones?.method || input?.method || "GET").toUpperCase();
}

function esRequestMismoOrigen(input) {
  if (typeof window === "undefined") return false;

  const url = typeof input === "string" ? input : input?.url;
  if (!url) return true;

  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch (error) {
    return false;
  }
}

export function instalarFetchConCSRF() {
  if (fetchConCSRFInstalado || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (input, opciones = {}) => {
    const metodo = obtenerMetodoRequest(input, opciones);

    if (!esMetodoMutante(metodo) || !esRequestMismoOrigen(input)) {
      return fetchOriginal(input, opciones);
    }

    const headers = new Headers(opciones.headers || input?.headers || {});
    headers.set("X-CSRFToken", await obtenerTokenCSRF());

    return fetchOriginal(input, {
      ...opciones,
      method: metodo,
      credentials: opciones.credentials || "include",
      headers,
    });
  };

  fetchConCSRFInstalado = true;
}
