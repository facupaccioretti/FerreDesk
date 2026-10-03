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

export function invalidarCachesProductos(queryClient) {
  const tenantScope = obtenerTenantScope()

  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.resources.all("productos") }),
    queryClient.invalidateQueries({ queryKey: ["producto-busqueda-ligera", tenantScope] }),
    queryClient.invalidateQueries({ queryKey: ["producto-lookup-rapido", tenantScope] }),
    queryClient.invalidateQueries({ queryKey: ["producto-lookup-compra", tenantScope] }),
  ])
}
