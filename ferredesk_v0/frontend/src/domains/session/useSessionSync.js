import { useEffect } from "react"
import { suscribirAvisosSesion } from "../../utils/clienteAPI"
import { useSessionCoordinator } from "./sessionCoordinator"

const CHANNEL_NAME = "ferredesk-session"
let canal = null

function obtenerCanal() {
  if (canal || typeof BroadcastChannel === "undefined") return canal
  canal = new BroadcastChannel(CHANNEL_NAME)
  return canal
}

export function restablecerCanalSesionSync() {
  if (canal) {
    try { canal.close(); } catch (_) {}
  }
  canal = null;
}

export function publicarRevalidacionSesion() {
  obtenerCanal()?.postMessage({ type: "revalidate-session" })
}

export function useSessionSync() {
  const { manejarAvisoSesion, transicionDura, revalidarSesion } = useSessionCoordinator()

  useEffect(() => {
    const ejecutar = (accion) => Promise.resolve(accion()).catch(() => {})
    const channel = obtenerCanal()
    const onMessage = (event) => {
      if (event.data?.type === "revalidate-session") ejecutar(transicionDura)
    }
    const onFocus = () => ejecutar(revalidarSesion)
    const desuscribir = suscribirAvisosSesion((aviso) => {
      ejecutar(() => manejarAvisoSesion(aviso))
    })

    channel?.addEventListener("message", onMessage)
    window.addEventListener("focus", onFocus)

    return () => {
      desuscribir()
      channel?.removeEventListener("message", onMessage)
      window.removeEventListener("focus", onFocus)
    }
  }, [manejarAvisoSesion, revalidarSesion, transicionDura])
}
