export const QUERY_PROFILES = {
  session: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  staticCatalog: {
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  warmCatalog: {
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  operationalList: {
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  },
  expensiveReport: {
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
}

export function withQueryProfile(profile, overrides = {}) {
  return {
    ...(QUERY_PROFILES[profile] || {}),
    ...overrides,
  }
}
