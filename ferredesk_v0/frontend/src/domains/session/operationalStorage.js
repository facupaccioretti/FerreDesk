const STORAGE_PREFIX = "ferredesk:operational:v1";

const FAMILIAS_OPERATIVAS = [
  /^(?:clientes|compras|caja|productos|presupuestos)(?:Tabs|ActiveTab)$/,
  /^productosEditStates$/,
  /^(?:cliente|proveedor|stock|presupuesto|venta|conVenta|notaCredito)FormDraft(?:_|$)/,
  /^editarPresupuestoDraft(?:_|$)/,
  /^stockFormDraft_.+_(?:precios|spPendientes|codPendientes|provAgregados|codPendEdic)$/,
  /^ferredesk_processes_v1:/,
  /^postventa:idempotency:/,
  /^(?:clientes_search|clientes_search_inactivos|productos_search)$/,
  /^(?:clientes|productos|stockBajo)ConsultaPersistida$/,
];

let ambitoActivo = null;

function storageDisponible(tipo) {
  if (typeof window === "undefined") return null;
  return tipo === "session" ? window.sessionStorage : window.localStorage;
}

function esClaveOperativa(clave) {
  return FAMILIAS_OPERATIVAS.some((patron) => patron.test(clave));
}

function validarClave(clave) {
  if (!esClaveOperativa(clave)) {
    throw new Error(`Clave de storage operativo no registrada: ${clave}`);
  }
}

function claveScoped(clave, tipo) {
  if (!ambitoActivo) return null;
  return `${STORAGE_PREFIX}:${ambitoActivo.tenant}:${ambitoActivo.perfil}:${tipo}:${clave}`;
}

function listarClaves(storage) {
  return Array.from({ length: storage.length }, (_, indice) => storage.key(indice)).filter(Boolean);
}

export function configurarAmbitoOperativo({ tenant, perfilId }) {
  if (!tenant || perfilId === null || perfilId === undefined || perfilId === "") {
    ambitoActivo = null;
    return;
  }

  ambitoActivo = {
    tenant: encodeURIComponent(String(tenant).toLowerCase()),
    perfil: encodeURIComponent(String(perfilId)),
  };
}

export function deshabilitarStorageOperativo() {
  ambitoActivo = null;
}

export function estaStorageOperativoHabilitado() {
  return Boolean(ambitoActivo);
}

export function leerEstadoOperativo(clave, { tipo = "local" } = {}) {
  validarClave(clave);
  const storage = storageDisponible(tipo);
  const scoped = claveScoped(clave, tipo);
  if (!storage || !scoped) return null;

  const valorScoped = storage.getItem(scoped);
  if (valorScoped !== null) return valorScoped;

  const valorLegacy = storage.getItem(clave);
  if (valorLegacy === null) return null;

  storage.setItem(scoped, valorLegacy);
  storage.removeItem(clave);
  return valorLegacy;
}

export function guardarEstadoOperativo(clave, valor, { tipo = "local" } = {}) {
  validarClave(clave);
  const storage = storageDisponible(tipo);
  const scoped = claveScoped(clave, tipo);
  if (!storage || !scoped) return false;

  storage.setItem(scoped, String(valor));
  return true;
}

export function eliminarEstadoOperativo(clave, { tipo = "local" } = {}) {
  validarClave(clave);
  const storage = storageDisponible(tipo);
  const scoped = claveScoped(clave, tipo);
  if (!storage) return;

  if (scoped) storage.removeItem(scoped);
  storage.removeItem(clave);
}

export function limpiarEstadoOperativo() {
  ["local", "session"].forEach((tipo) => {
    const storage = storageDisponible(tipo);
    if (!storage) return;

    const prefijoScoped = ambitoActivo
      ? `${STORAGE_PREFIX}:${ambitoActivo.tenant}:${ambitoActivo.perfil}:${tipo}:`
      : null;

    listarClaves(storage).forEach((clave) => {
      if ((prefijoScoped && clave.startsWith(prefijoScoped)) || esClaveOperativa(clave)) {
        storage.removeItem(clave);
      }
    });
  });
}

export const operationalLocalStorage = {
  getItem: (clave) => leerEstadoOperativo(clave),
  setItem: (clave, valor) => guardarEstadoOperativo(clave, valor),
  removeItem: (clave) => eliminarEstadoOperativo(clave),
};

export const operationalSessionStorage = {
  getItem: (clave) => leerEstadoOperativo(clave, { tipo: "session" }),
  setItem: (clave, valor) => guardarEstadoOperativo(clave, valor, { tipo: "session" }),
  removeItem: (clave) => eliminarEstadoOperativo(clave, { tipo: "session" }),
};
