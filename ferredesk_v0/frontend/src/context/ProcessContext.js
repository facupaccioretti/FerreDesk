import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-toastify"
import { useQueryClient } from "@tanstack/react-query"
import { obtenerTenantScope } from "../core/query/tenantScope"
import { queryKeys } from "../core/query/queryKeys"
import { clienteAPI } from "../utils/clienteAPI"

const ProcessContext = createContext(null)

const ESTADOS_ACTIVOS = new Set(["pendiente", "procesando"])
const IMPACTO_CRITICO = "critico"
const STORAGE_PREFIX = "ferredesk_processes_v1"

function crearStorageKey(tenantScope) {
  return `${STORAGE_PREFIX}:${tenantScope}`
}

function construirTituloProceso(proceso) {
  const proveedor = proceso.proveedorNombre ? ` de ${proceso.proveedorNombre}` : ""

  if (proceso.tipo === "actualizacion_lista_precios") {
    return `Actualizacion de precios${proveedor}`
  }

  if (proceso.tipo === "carga_inicial_proveedor") {
    return `Carga inicial${proveedor}`
  }

  return proceso.titulo || "Proceso del sistema"
}

function construirMensajeProceso(proceso) {
  const proveedor = proceso.proveedorNombre ? ` de ${proceso.proveedorNombre}` : ""

  if (proceso.estado === "error") {
    return proceso.mensaje_error || "El proceso finalizo con error."
  }

  if (proceso.tipo === "actualizacion_lista_precios") {
    if (proceso.estado === "completada") {
      return `Actualizacion finalizada${proveedor}.`
    }
    return `Actualizacion de lista de precios${proveedor} en curso.`
  }

  if (proceso.tipo === "carga_inicial_proveedor") {
    if (proceso.estado === "completada") {
      return `Carga inicial finalizada${proveedor}.`
    }
    return `Carga inicial${proveedor} en curso.`
  }

  return proceso.mensaje || "Proceso en curso."
}

function normalizarProcesoPersistido(proceso, tenantScope) {
  if (!proceso || !proceso.id || !proceso.tipo || !proceso.proveedorId) {
    return null
  }

  const normalizado = {
    impacto_operativo: IMPACTO_CRITICO,
    mensaje: "",
    registros_actualizados: 0,
    registros_creados: 0,
    registros_procesados: 0,
    registros_saltados: 0,
    tenantScope,
    titulo: "Proceso en curso",
    ...proceso,
  }

  return {
    ...normalizado,
    titulo: construirTituloProceso(normalizado),
    mensaje: normalizado.mensaje || construirMensajeProceso(normalizado),
  }
}

async function obtenerEstadoProceso(proceso) {
  if (proceso.tipo === "actualizacion_lista_precios") {
    return clienteAPI(
      `/api/productos/proveedores/${proceso.proveedorId}/importaciones-listas/${proceso.id}/`
    )
  }

  if (proceso.tipo === "carga_inicial_proveedor") {
    return clienteAPI(
      `/api/proveedores/${proceso.proveedorId}/carga-inicial/importaciones/${proceso.id}/`
    )
  }

  throw new Error(`Tipo de proceso no soportado: ${proceso.tipo}`)
}

function mapearEstadoProceso(proceso, payload) {
  const estado = payload?.estado || proceso.estado
  const procesoActualizado = {
    ...proceso,
    estado,
    actualizado_en:
      payload?.actualizado_en ||
      payload?.finalizado_en ||
      payload?.iniciado_en ||
      proceso.actualizado_en,
    creado_en: payload?.creado_en || proceso.creado_en,
    finalizado_en: payload?.finalizado_en || proceso.finalizado_en,
    iniciado_en: payload?.iniciado_en || proceso.iniciado_en,
    mensaje_error: payload?.mensaje_error || "",
    registros_actualizados: payload?.registros_actualizados || 0,
    registros_creados: payload?.registros_creados || 0,
    registros_procesados: payload?.registros_procesados || 0,
    registros_saltados: payload?.registros_saltados || 0,
  }

  return {
    ...procesoActualizado,
    titulo: construirTituloProceso(procesoActualizado),
    mensaje: construirMensajeProceso(procesoActualizado),
  }
}

export function ProcessProvider({ children }) {
  const tenantScope = obtenerTenantScope()
  const queryClient = useQueryClient()
  const [procesos, setProcesos] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const estadoPrevioRef = useRef(new Map())

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }

    try {
      const raw = window.localStorage.getItem(crearStorageKey(tenantScope))
      const parsed = raw ? JSON.parse(raw) : []
      const procesosPersistidos = Array.isArray(parsed)
        ? parsed
            .map((proceso) => normalizarProcesoPersistido(proceso, tenantScope))
            .filter(Boolean)
        : []
      setProcesos(procesosPersistidos)
    } catch (_) {
      setProcesos([])
    } finally {
      setLoading(false)
    }
  }, [tenantScope])

  useEffect(() => {
    if (typeof window === "undefined" || loading) {
      return
    }

    window.localStorage.setItem(crearStorageKey(tenantScope), JSON.stringify(procesos))
  }, [loading, procesos, tenantScope])

  useEffect(() => {
    if (loading) {
      return
    }

    const estadoActual = new Map()

    procesos.forEach((proceso) => {
      const clave = `${proceso.tipo}:${proceso.id}`
      const estadoAnterior = estadoPrevioRef.current.get(clave)
      estadoActual.set(clave, proceso.estado)

      if (!estadoAnterior || estadoAnterior === proceso.estado) {
        return
      }

      if (proceso.estado === "completada") {
        toast.success(proceso.mensaje || `${proceso.titulo} finalizada.`)

        const processInvalidationMap = {
          actualizacion_lista_precios: ["productos", "proveedores"],
          carga_inicial_proveedor: ["productos", "proveedores"],
        }

        const claves = processInvalidationMap[proceso.tipo] || []
        claves.forEach((clave) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.resources.all(clave) })
        })
      } else if (proceso.estado === "error") {
        toast.error(
          proceso.mensaje_error || proceso.mensaje || `${proceso.titulo} finalizo con error.`
        )
      }
    })

    estadoPrevioRef.current = estadoActual
  }, [loading, procesos, queryClient])

  useEffect(() => {
    if (loading) {
      return undefined
    }

    const procesosActivos = procesos.filter((proceso) => ESTADOS_ACTIVOS.has(proceso.estado))
    if (procesosActivos.length === 0) {
      return undefined
    }

    let cancelado = false

    const refrescarProcesos = async () => {
      try {
        const resultados = await Promise.all(
          procesosActivos.map(async (proceso) => {
            try {
              const payload = await obtenerEstadoProceso(proceso)
              return mapearEstadoProceso(proceso, payload)
            } catch (error) {
              return mapearEstadoProceso(proceso, {
                estado: "error",
                mensaje_error:
                  error.message || "No se pudo consultar el estado del proceso.",
              })
            }
          })
        )

        if (cancelado) {
          return
        }

        setProcesos((anteriores) =>
          anteriores.map((proceso) => {
            const actualizado = resultados.find(
              (resultado) =>
                resultado.id === proceso.id && resultado.tipo === proceso.tipo
            )
            return actualizado || proceso
          })
        )
      } finally {
        if (!cancelado) {
          setLoading(false)
        }
      }
    }

    refrescarProcesos()
    const timer = window.setInterval(refrescarProcesos, 5000)

    return () => {
      cancelado = true
      window.clearInterval(timer)
    }
  }, [loading, procesos])

  const value = useMemo(() => {
    const procesosActivos = procesos.filter((proceso) => ESTADOS_ACTIVOS.has(proceso.estado))
    const procesosRecientes = procesos
      .filter((proceso) => !ESTADOS_ACTIVOS.has(proceso.estado))
      .slice(0, 10)

    const registrarProceso = (proceso) => {
      const procesoNormalizado = normalizarProcesoPersistido(
        {
          creado_en: new Date().toISOString(),
          estado: "pendiente",
          ...proceso,
        },
        tenantScope
      )

      if (!procesoNormalizado) {
        return
      }

      setProcesos((anteriores) => {
        const existentes = anteriores.filter(
          (actual) =>
            !(actual.id === procesoNormalizado.id && actual.tipo === procesoNormalizado.tipo)
        )
        return [procesoNormalizado, ...existentes]
      })
    }

    const obtenerProceso = (tipo, id) =>
      procesos.find((proceso) => proceso.tipo === tipo && proceso.id === id) || null

    const cerrarProceso = (tipo, id) => {
      setProcesos((anteriores) =>
        anteriores.filter((proceso) => !(proceso.tipo === tipo && proceso.id === id))
      )
    }

    return {
      cerrarProceso,
      drawerOpen,
      loading,
      obtenerProceso,
      procesos,
      procesosActivos,
      procesosRecientes,
      registrarProceso,
      setDrawerOpen,
      tenantScope,
    }
  }, [drawerOpen, loading, procesos, tenantScope])

  return <ProcessContext.Provider value={value}>{children}</ProcessContext.Provider>
}

export function useProcessContext() {
  const context = useContext(ProcessContext)

  if (!context) {
    throw new Error("useProcessContext debe usarse dentro de ProcessProvider")
  }

  return context
}
