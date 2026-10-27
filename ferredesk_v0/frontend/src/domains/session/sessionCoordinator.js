import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { obtenerTenantScope } from "../../core/query/tenantScope"
import { queryKeys } from "../../core/query/queryKeys"
import { establecerPerfilEsperado } from "../../utils/clienteAPI"
import { obtenerUsuarioSesion } from "./sessionApi"
import {
  configurarAmbitoOperativo,
  deshabilitarStorageOperativo,
  limpiarEstadoOperativo,
} from "./operationalStorage"
import { useSessionUserQuery } from "./useSessionUserQuery"

const SessionCoordinatorContext = createContext(null)

function perfilId(user) {
  return user?.perfil_activo?.id ?? null
}

function perfilStorageId(user) {
  if (!user) return null
  if (!user.perfiles_adoptados) return "titular"
  return perfilId(user)
}

function snapshotSesion(user) {
  if (!user) return null
  return JSON.stringify({
    cuenta: user.cuenta ?? null,
    perfilId: perfilId(user),
    perfilesAdoptados: Boolean(user.perfiles_adoptados),
    requiereIdentificacion: Boolean(user.requiere_identificacion),
    motivo: user.motivo_requiere_identificacion ?? null,
    permisos: [...(user.permisos_efectivos ?? [])].sort(),
    capacidades: Object.entries(user.capacidades ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  })
}

export function SessionCoordinatorProvider({ children }) {
  const queryClient = useQueryClient()
  const sessionQuery = useSessionUserQuery()
  const [bloqueada, setBloqueada] = useState(true)
  const [operationalReady, setOperationalReady] = useState(false)
  const [requiereReidentificacion, setRequiereReidentificacion] = useState(false)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [transitionError, setTransitionError] = useState(null)
  const transicionRef = useRef(null)
  const inicializadaRef = useRef(false)

  const aplicarSesion = useCallback((user) => {
    queryClient.setQueryData(queryKeys.session.user(), user)
    const storageId = perfilStorageId(user)

    if (storageId === null) {
      deshabilitarStorageOperativo()
      establecerPerfilEsperado(null)
      setOperationalReady(false)
    } else {
      configurarAmbitoOperativo({ tenant: obtenerTenantScope(), perfilId: storageId })
      establecerPerfilEsperado(perfilId(user))
      setOperationalReady(true)
    }

    const requiere = Boolean(user?.requiere_identificacion)
    setRequiereReidentificacion(requiere)
    setBloqueada(requiere)
    setTransitionError(null)
    return user
  }, [queryClient])

  useEffect(() => {
    if (!sessionQuery.isSuccess || inicializadaRef.current) return
    inicializadaRef.current = true
    aplicarSesion(sessionQuery.data ?? null)
  }, [aplicarSesion, sessionQuery.data, sessionQuery.isSuccess])

  useEffect(() => () => {
    establecerPerfilEsperado(null)
    deshabilitarStorageOperativo()
  }, [])

  const consultarSesion = useCallback(() => queryClient.fetchQuery({
    queryKey: queryKeys.session.user(),
    queryFn: obtenerUsuarioSesion,
    staleTime: 0,
    retry: false,
  }), [queryClient])

  const ejecutarDura = useCallback(async (userYaConsultado) => {
    setBloqueada(true)
    setOperationalReady(false)
    setRequiereReidentificacion(false)
    setTransitionError(null)
    establecerPerfilEsperado(null)
    limpiarEstadoOperativo()
    deshabilitarStorageOperativo()
    queryClient.clear()

    try {
      const user = userYaConsultado === undefined ? await consultarSesion() : userYaConsultado
      aplicarSesion(user)
      setSessionGeneration((actual) => actual + 1)
      return user
    } catch (error) {
      setTransitionError(error)
      setBloqueada(true)
      throw error
    }
  }, [aplicarSesion, consultarSesion, queryClient])

  const transicionDura = useCallback(() => {
    if (transicionRef.current) return transicionRef.current

    const promesa = ejecutarDura()
      .finally(() => {
        if (transicionRef.current === promesa) transicionRef.current = null
      })
    transicionRef.current = promesa
    return promesa
  }, [ejecutarDura])

  const marcarReidentificacionSuave = useCallback(() => {
    setBloqueada(true)
    setRequiereReidentificacion(true)
    setTransitionError(null)
  }, [])

  const reidentificacionSuave = useCallback(async (perfilAnteriorId) => {
    setBloqueada(true)
    setTransitionError(null)

    try {
      const user = await consultarSesion()
      if (perfilId(user) !== perfilAnteriorId) {
        return ejecutarDura(user)
      }

      aplicarSesion(user)
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "session",
        refetchType: "active",
      })
      return user
    } catch (error) {
      setTransitionError(error)
      setBloqueada(true)
      throw error
    }
  }, [aplicarSesion, consultarSesion, ejecutarDura, queryClient])

  const revalidarSesion = useCallback(async () => {
    const anterior = queryClient.getQueryData(queryKeys.session.user()) ?? null
    const remoto = await consultarSesion()

    if (
      anterior?.perfil_activo &&
      remoto?.requiere_identificacion &&
      remoto?.motivo_requiere_identificacion === "perfil_expirado_por_inactividad"
    ) {
      queryClient.setQueryData(queryKeys.session.user(), remoto)
      marcarReidentificacionSuave()
      return remoto
    }

    if (snapshotSesion(anterior) === snapshotSesion(remoto)) {
      aplicarSesion(remoto)
      return remoto
    }

    return ejecutarDura(remoto)
  }, [aplicarSesion, consultarSesion, ejecutarDura, marcarReidentificacionSuave, queryClient])

  const manejarAvisoSesion = useCallback((aviso) => {
    if (aviso.accion === "suave") {
      marcarReidentificacionSuave()
      return Promise.resolve()
    }
    if (aviso.accion === "revalidar") return revalidarSesion()
    return transicionDura()
  }, [marcarReidentificacionSuave, revalidarSesion, transicionDura])

  const value = useMemo(() => ({
    bloqueada,
    manejarAvisoSesion,
    marcarReidentificacionSuave,
    operationalReady,
    reidentificacionSuave,
    revalidarSesion,
    sessionGeneration,
    transicionDura,
    transitionError,
    requiereReidentificacion,
  }), [
    bloqueada,
    manejarAvisoSesion,
    marcarReidentificacionSuave,
    operationalReady,
    reidentificacionSuave,
    revalidarSesion,
    requiereReidentificacion,
    sessionGeneration,
    transicionDura,
    transitionError,
  ])

  return (
    <SessionCoordinatorContext.Provider value={value}>
      {children}
    </SessionCoordinatorContext.Provider>
  )
}

export function useSessionCoordinator() {
  const context = useContext(SessionCoordinatorContext)
  if (!context) throw new Error("useSessionCoordinator debe usarse dentro de SessionCoordinatorProvider")
  return context
}
