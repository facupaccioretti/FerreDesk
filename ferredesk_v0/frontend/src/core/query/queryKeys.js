import { normalizarParametrosQuery, obtenerTenantScope } from "./tenantScope"

export const queryKeys = {
  session: {
    all: ["session"],
    user: () => ["session", "user"],
  },
  resources: {
    all: (resource) => ["resource", obtenerTenantScope(), resource],
    list: (resource, parametros = {}) => [
      "resource",
      obtenerTenantScope(),
      resource,
      "list",
      normalizarParametrosQuery(parametros),
    ],
  },
}
