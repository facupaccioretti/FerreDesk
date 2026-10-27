import { useCallback, useEffect, useRef } from "react"
import { registrarActividadPerfil } from "./sessionApi"
import { useSessionCoordinator } from "./sessionCoordinator"
import { useSessionUserQuery } from "./useSessionUserQuery"

const INTERVALO_HEARTBEAT_MS = 60 * 1000
const EVENTOS_HUMANOS = ["pointerdown", "keydown", "touchstart"]

export function useInactivitySession() {
  const { user } = useSessionUserQuery()
  const { revalidarSesion } = useSessionCoordinator()
  const timerRef = useRef(null)
  const ultimoHeartbeatRef = useRef(0)
  const montadoRef = useRef(true)
  const timeoutMs = Number(user?.inactividad_segundos) * 1000
  const perfilActivo = user?.perfil_activo?.id ?? null

  const limpiarTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const reiniciarTimer = useCallback(() => {
    limpiarTimer()
    if (!perfilActivo || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return

    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null
      try {
        const remoto = await revalidarSesion()
        if (montadoRef.current && remoto?.perfil_activo?.id === perfilActivo) reiniciarTimer()
      } catch (_) {
      }
    }, timeoutMs)
  }, [limpiarTimer, perfilActivo, revalidarSesion, timeoutMs])

  useEffect(() => {
    montadoRef.current = true
    if (!perfilActivo || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      limpiarTimer()
      return undefined
    }

    const onActividadHumana = () => {
      reiniciarTimer()
      const ahora = Date.now()
      if (ahora - ultimoHeartbeatRef.current < INTERVALO_HEARTBEAT_MS) return

      ultimoHeartbeatRef.current = ahora
      registrarActividadPerfil().catch(() => {})
    }

    reiniciarTimer()
    EVENTOS_HUMANOS.forEach((evento) => window.addEventListener(evento, onActividadHumana, { passive: true }))

    return () => {
      montadoRef.current = false
      limpiarTimer()
      EVENTOS_HUMANOS.forEach((evento) => window.removeEventListener(evento, onActividadHumana))
    }
  }, [limpiarTimer, perfilActivo, reiniciarTimer, timeoutMs])
}
