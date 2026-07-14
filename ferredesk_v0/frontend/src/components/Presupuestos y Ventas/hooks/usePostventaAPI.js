import { useCallback, useEffect, useState } from "react"
import { getCookie } from "../../../utils/csrf"

const STORAGE_PREFIX = "postventa:idempotency:"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const esUUID = (value) => UUID_PATTERN.test(String(value || ""))

export const generarIdempotencyKey = () => {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : undefined

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5")
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export const obtenerIdempotencyKey = (comprobanteId) => {
  if (typeof window === "undefined" || !comprobanteId) {
    return generarIdempotencyKey()
  }

  const storageKey = `${STORAGE_PREFIX}${comprobanteId}`
  const existente = window.sessionStorage.getItem(storageKey)

  if (esUUID(existente)) {
    return existente
  }

  if (existente) window.sessionStorage.removeItem(storageKey)

  const nuevo = generarIdempotencyKey()
  window.sessionStorage.setItem(storageKey, nuevo)
  return nuevo
}

const guardarIdempotencyKey = (comprobanteId, value) => {
  if (typeof window === "undefined" || !comprobanteId || !value) return
  window.sessionStorage.setItem(`${STORAGE_PREFIX}${comprobanteId}`, value)
}

const parsearRespuesta = async (response) => {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text()
  return text ? { detail: text } : {}
}

const extraerMensajeError = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value.map(extraerMensajeError).filter(Boolean).join(" ")
  }
  if (typeof value === "object") {
    if (typeof value.detail === "string") return value.detail
    if (typeof value.message === "string") return value.message

    return Object.entries(value)
      .map(([key, mensaje]) => {
        const texto = extraerMensajeError(mensaje)
        return texto ? `${key}: ${texto}` : ""
      })
      .filter(Boolean)
      .join(" | ")
  }
  return String(value)
}

const usePostventaAPI = (comprobanteId) => {
  const [idempotencyKey, setIdempotencyKey] = useState(() => obtenerIdempotencyKey(comprobanteId))
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    setIdempotencyKey(obtenerIdempotencyKey(comprobanteId))
    setPreview(null)
    setError(null)
  }, [comprobanteId])

  const ejecutarRequest = useCallback(async (url, payload, { includeIdempotency = false } = {}) => {
    const csrftoken = getCookie("csrftoken")
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
        ...(includeIdempotency ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      credentials: "include",
      body: JSON.stringify(
        includeIdempotency
          ? {
            ...payload,
            idempotency_key: idempotencyKey,
          }
          : payload,
      ),
    })

    const data = await parsearRespuesta(response)

    if (!response.ok) {
      throw new Error(extraerMensajeError(data) || "No se pudo procesar la operacion")
    }

    return data
  }, [idempotencyKey])

  const previsualizarDevolucion = useCallback(async (payload) => {
    setPreviewLoading(true)
    setPreview(null)
    setError(null)

    try {
      const data = await ejecutarRequest("/api/postventa/devoluciones/previsualizar/", payload)
      setPreview(data)
      return data
    } catch (err) {
      setError(extraerMensajeError(err.message) || "No se pudo preparar la devolucion")
      throw err
    } finally {
      setPreviewLoading(false)
    }
  }, [ejecutarRequest])

  const confirmarDevolucion = useCallback(async (payload) => {
    setConfirmLoading(true)
    setError(null)

    try {
      return await ejecutarRequest(
        "/api/postventa/devoluciones/confirmar/",
        payload,
        { includeIdempotency: true },
      )
    } catch (err) {
      setError(extraerMensajeError(err.message) || "No se pudo confirmar la devolucion")
      throw err
    } finally {
      setConfirmLoading(false)
    }
  }, [ejecutarRequest])

  const previsualizarCambio = useCallback(async (payload) => {
    setPreviewLoading(true)
    setPreview(null)
    setError(null)

    try {
      const data = await ejecutarRequest("/api/postventa/cambios/previsualizar/", payload)
      setPreview(data)
      return data
    } catch (err) {
      setError(extraerMensajeError(err.message) || "No se pudo preparar el cambio")
      throw err
    } finally {
      setPreviewLoading(false)
    }
  }, [ejecutarRequest])

  const confirmarCambio = useCallback(async (payload) => {
    setConfirmLoading(true)
    setError(null)

    try {
      return await ejecutarRequest(
        "/api/postventa/cambios/confirmar/",
        payload,
        { includeIdempotency: true },
      )
    } catch (err) {
      setError(extraerMensajeError(err.message) || "No se pudo confirmar el cambio")
      throw err
    } finally {
      setConfirmLoading(false)
    }
  }, [ejecutarRequest])

  const resetPreview = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  const renewIdempotencyKey = useCallback(() => {
    const nuevo = generarIdempotencyKey()
    guardarIdempotencyKey(comprobanteId, nuevo)
    setIdempotencyKey(nuevo)
    setPreview(null)
    setError(null)
    return nuevo
  }, [comprobanteId])

  return {
    idempotencyKey,
    preview,
    error,
    previewLoading,
    confirmLoading,
    previsualizarDevolucion,
    confirmarDevolucion,
    previsualizarCambio,
    confirmarCambio,
    resetPreview,
    renewIdempotencyKey,
  }
}

export default usePostventaAPI
