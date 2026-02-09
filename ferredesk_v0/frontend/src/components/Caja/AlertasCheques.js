"use client"

import { useEffect, useState, useCallback } from "react"

// Umbrales fijos de alerta
const DIAS_CRITICO = 10    // Cheques que vencen en menos de 10 días
const DIAS_PROXIMO = 30    // Cheques que vencen en los próximos 30 días

/**
 * Banner de alertas por cheques próximos a vencer.
 * Fase 5: muestra dos niveles de alerta fijos:
 * - CRÍTICO (rojo): cheques que vencen en menos de 10 días
 * - PRÓXIMO A VENCER (amarillo): cheques que vencen en los próximos 30 días
 */
const AlertasCheques = () => {
  const [cantidadCritico, setCantidadCritico] = useState(0)
  const [cantidadProximo, setCantidadProximo] = useState(0)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      // Cargar ambos niveles en paralelo
      const [resCritico, resProximo] = await Promise.all([
        fetch(`/api/caja/cheques/alertas-vencimiento/?dias=${DIAS_CRITICO}`, { credentials: "include" }),
        fetch(`/api/caja/cheques/alertas-vencimiento/?dias=${DIAS_PROXIMO}`, { credentials: "include" }),
      ])

      const dataCritico = await resCritico.json()
      const dataProximo = await resProximo.json()

      if (!resCritico.ok) throw new Error(dataCritico.detail || dataCritico.error || "Error cargando alertas críticas")
      if (!resProximo.ok) throw new Error(dataProximo.detail || dataProximo.error || "Error cargando alertas próximas")

      const critico = Number(dataCritico.cantidad) || 0
      const proximo = Number(dataProximo.cantidad) || 0

      setCantidadCritico(critico)
      // Próximo excluye los críticos para no duplicar conteo visual
      setCantidadProximo(proximo - critico)
    } catch (err) {
      console.error("Error cargando alertas cheques:", err)
      setCantidadCritico(0)
      setCantidadProximo(0)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // No mostrar nada si está cargando o no hay alertas
  if (cargando || (cantidadCritico <= 0 && cantidadProximo <= 0)) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Alerta CRÍTICA - menos de 10 días */}
      {cantidadCritico > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-sm">⚠️</span>
            <div className="text-xs text-red-800 font-medium">
              <strong>CRÍTICO:</strong> Tenés <strong>{cantidadCritico}</strong> cheque{cantidadCritico > 1 ? "s" : ""} que vence{cantidadCritico > 1 ? "n" : ""} en menos de <strong>{DIAS_CRITICO} días</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Alerta PRÓXIMO A VENCER - 30 días (excluyendo los críticos) */}
      {cantidadProximo > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-sm">🔔</span>
            <div className="text-xs text-amber-800">
              <strong>Próximo a vencer:</strong> Tenés <strong>{cantidadProximo}</strong> cheque{cantidadProximo > 1 ? "s" : ""} que vence{cantidadProximo > 1 ? "n" : ""} en los próximos <strong>{DIAS_PROXIMO} días</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertasCheques

