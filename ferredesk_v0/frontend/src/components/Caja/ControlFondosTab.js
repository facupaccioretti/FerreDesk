"use client"

import { useCallback, useEffect, useState } from "react"
import { useCajaAPI } from "../../utils/useCajaAPI"
import { formatearMoneda } from "../../utils/formatters"

const KPI_LABELS = {
  disponible_hoy: "Disponible hoy",
  caja: "En caja",
  bancos: "En bancos",
  cheques_en_cartera: "En cartera",
  pendiente_acreditacion: "Pendiente de acreditacion",
  total_administrado: "Total administrado",
}

const COMPONENTE_LABELS = {
  caja: "Caja",
  bancos: "Bancos",
  cheques_en_cartera: "Cheques en cartera",
  pendiente_acreditacion: "Pendiente de acreditacion",
}

const ORDEN_KPIS = [
  "disponible_hoy",
  "caja",
  "bancos",
  "cheques_en_cartera",
  "pendiente_acreditacion",
  "total_administrado",
]

const KPI_ACCENT_STYLES = {
  disponible_hoy: "border-emerald-200 bg-emerald-50 text-emerald-950",
  caja: "border-amber-200 bg-amber-50 text-amber-950",
  bancos: "border-sky-200 bg-sky-50 text-sky-950",
  cheques_en_cartera: "border-violet-200 bg-violet-50 text-violet-950",
  pendiente_acreditacion: "border-cyan-200 bg-cyan-50 text-cyan-950",
  total_administrado: "border-slate-300 bg-slate-900 text-white",
}

function parseMonto(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function renderMonto(value) {
  return `$${formatearMoneda(parseMonto(value))}`
}

const ComposicionRow = ({ codigo, monto, onClick, tone = "default" }) => {
  const esClickable = typeof onClick === "function"
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-200 bg-white/70 text-emerald-950 hover:bg-white"
      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"

  return (
    <button
      type="button"
      onClick={esClickable ? onClick : undefined}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
        esClickable ? toneClasses : "border-transparent bg-transparent"
      }`}
    >
      <span className="text-sm font-medium">{COMPONENTE_LABELS[codigo] || codigo}</span>
      <div className="flex items-center gap-3">
        {esClickable && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Abrir</span>}
        <span className="text-sm font-semibold">{renderMonto(monto)}</span>
      </div>
    </button>
  )
}

const KpiCard = ({ codigo, data, onClick, esPrincipal = false, subtitulo = null }) => {
  const esClickable = typeof onClick === "function"
  const accentStyles = KPI_ACCENT_STYLES[codigo] || "border-slate-200 bg-white text-slate-900"
  const tituloClass = codigo === "total_administrado" ? "text-slate-300" : "text-slate-500"
  const descripcionClass = codigo === "total_administrado" ? "text-slate-200" : "text-slate-700"
  const badgeClass =
    codigo === "total_administrado" ? "bg-white/10 text-white" : "bg-white/80 text-slate-700"

  return (
    <button
      type="button"
      onClick={esClickable ? onClick : undefined}
      className={`rounded-2xl border p-4 text-left transition-all ${accentStyles} ${
        esClickable ? "hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${esPrincipal ? "min-h-[220px]" : "min-h-[170px]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tituloClass}`}>
            {KPI_LABELS[codigo] || codigo}
          </p>
          <p className={`mt-2 font-bold ${esPrincipal ? "text-4xl" : "text-3xl"}`}>
            {renderMonto(data?.monto)}
          </p>
          {subtitulo && <p className={`mt-2 text-xs font-medium ${descripcionClass}`}>{subtitulo}</p>}
        </div>
        {esClickable && (
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badgeClass}`}>
            Ver detalle
          </span>
        )}
      </div>
      <p className={`mt-4 text-sm ${descripcionClass}`}>
        {data?.descripcion || "Sin descripcion disponible"}
      </p>
    </button>
  )
}

const ControlFondosTab = ({ onDrilldown, focusView = "resumen" }) => {
  const { obtenerPosicionTesoreria } = useCajaAPI()
  const [cargando, setCargando] = useState(true)
  const [payload, setPayload] = useState(null)
  const [vistaInterna, setVistaInterna] = useState("resumen")

  const cargarControlFondos = useCallback(async () => {
    setCargando(true)
    try {
      const resultado = await obtenerPosicionTesoreria()
      setPayload(resultado)
    } catch (error) {
      console.error("Error al cargar control de fondos:", error)
      setPayload(null)
    } finally {
      setCargando(false)
    }
  }, [obtenerPosicionTesoreria])

  useEffect(() => {
    cargarControlFondos()
  }, [cargarControlFondos])

  useEffect(() => {
    if (focusView) {
      setVistaInterna(focusView)
    }
  }, [focusView])

  const kpis = payload?.resumen_actual?.kpis || {}
  const composicionDisponible = payload?.composicion?.disponible_hoy?.componentes || []
  const composicionTotal = payload?.composicion?.total_administrado?.componentes || []
  const seniales = payload?.seniales || {}
  const drilldown = payload?.drilldown || {}

  const resumenKpis = ORDEN_KPIS.map((codigo) => ({ codigo, data: kpis[codigo] })).filter(
    (item) => item.data
  )

  const handleCardClick = (codigo) => {
    const metadata = drilldown[codigo]
    if (!metadata) return

    if (metadata.tab === "control_fondos" && metadata.vista_inicial) {
      setVistaInterna(metadata.vista_inicial)
      return
    }

    if (typeof onDrilldown === "function") {
      onDrilldown(codigo, metadata)
    }
  }

  const handleComponenteClick = (codigo) => {
    handleCardClick(codigo)
  }

  const disponibleHoyMonto = parseMonto(kpis.disponible_hoy?.monto)
  const totalAdministradoMonto = parseMonto(kpis.total_administrado?.monto)
  const fondosNoLiquidosHoy = totalAdministradoMonto - disponibleHoyMonto
  const resumenEjecutivo = fondoSNoLiquidosHoyLabel(fondosNoLiquidosHoy)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Control de Fondos</h3>
            <p className="mt-1 text-sm text-slate-600">
              Vista actual de Tesoreria basada solo en registros del sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={cargarControlFondos}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <KpiCard
          codigo="disponible_hoy"
          data={kpis.disponible_hoy}
          esPrincipal={true}
          subtitulo="Liquidez inmediata"
          onClick={drilldown.disponible_hoy ? () => handleCardClick("disponible_hoy") : undefined}
        />
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Lectura ejecutiva
          </p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{resumenEjecutivo.titulo}</p>
          <p className="mt-2 text-sm text-slate-600">{resumenEjecutivo.descripcion}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Liquido hoy</p>
              <p className="mt-2 text-2xl font-bold text-emerald-950">{renderMonto(disponibleHoyMonto)}</p>
              <p className="mt-2 text-sm text-emerald-900">Caja abierta y bancos registrados.</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">No liquido hoy</p>
              <p className="mt-2 text-2xl font-bold text-violet-950">{renderMonto(fondosNoLiquidosHoy)}</p>
              <p className="mt-2 text-sm text-violet-900">Cheques en cartera y depositados aun sin acreditar.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {resumenKpis
          .filter(({ codigo }) => codigo !== "disponible_hoy" && codigo !== "total_administrado")
          .map(({ codigo, data }) => (
          <KpiCard
            key={codigo}
            codigo={codigo}
            data={data}
            onClick={drilldown[codigo] ? () => handleCardClick(codigo) : undefined}
          />
          ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <KpiCard
          codigo="total_administrado"
          data={kpis.total_administrado}
          esPrincipal={true}
          subtitulo="Incluye fondos disponibles y valores administrados"
          onClick={drilldown.total_administrado ? () => handleCardClick("total_administrado") : undefined}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Diferencia clave
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Disponible hoy</p>
              <p className="mt-1 text-sm text-slate-600">
                Refleja solo lo utilizable ahora mismo sin esperar acreditaciones ni mover cheques.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Total administrado</p>
              <p className="mt-1 text-sm text-slate-600">
                Suma toda la posicion bajo Tesoreria, incluso valores que todavia no son liquidez inmediata.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm font-semibold text-cyan-950">Pendiente de acreditacion</p>
              <p className="mt-1 text-sm text-cyan-900">
                {renderMonto(kpis.pendiente_acreditacion?.monto)} sigue administrado, pero no entra en la disponibilidad de hoy.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Composicion actual</h4>
            <p className="mt-1 text-sm text-slate-600">
              Liquidez inmediata y total administrado, sin cambiar de pantalla.
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setVistaInterna("resumen")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                vistaInterna === "resumen" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Resumen
            </button>
            <button
              type="button"
              onClick={() => setVistaInterna("composicion")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                vistaInterna === "composicion" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Ver composicion
            </button>
          </div>
        </div>

        {vistaInterna === "composicion" && (
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Disponible hoy
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {renderMonto(payload?.composicion?.disponible_hoy?.total)}
              </p>
              <p className="mt-2 text-sm text-emerald-900">
                Hace click en cada componente para abrir la tab correspondiente.
              </p>
              <div className="mt-4 space-y-2">
                {composicionDisponible.map((item) => (
                  <ComposicionRow
                    key={item.codigo}
                    codigo={item.codigo}
                    monto={item.monto}
                    tone="emerald"
                    onClick={drilldown[item.codigo] ? () => handleComponenteClick(item.codigo) : undefined}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                Total administrado
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {renderMonto(payload?.composicion?.total_administrado?.total)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Cada subtotal abre el detalle existente sin salir del modulo.
              </p>
              <div className="mt-4 space-y-2">
                {composicionTotal.map((item) => (
                  <ComposicionRow
                    key={item.codigo}
                    codigo={item.codigo}
                    monto={item.monto}
                    onClick={drilldown[item.codigo] ? () => handleComponenteClick(item.codigo) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {vistaInterna === "resumen" && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Liquidez inmediata</p>
              <p className="mt-2 text-sm text-slate-600">
                {KPI_LABELS.disponible_hoy} combina solo caja abierta y bancos.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Valores no liquidos hoy</p>
              <p className="mt-2 text-sm text-slate-600">
                En cartera y pendiente de acreditacion siguen administrados, pero no son disponibilidad inmediata.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Estado operativo</p>
              <p className="mt-2 text-sm text-slate-600">
                {seniales.hay_caja_abierta ? "Hay caja abierta." : "No hay caja abierta."}{" "}
                {seniales.cantidad_cuentas_activas || 0} cuenta{seniales.cantidad_cuentas_activas === 1 ? "" : "s"} activa
                {seniales.cantidad_cuentas_activas === 1 ? "" : "s"} y{" "}
                {seniales.cantidad_cheques_pendientes || 0} cheque
                {seniales.cantidad_cheques_pendientes === 1 ? "" : "s"} pendiente
                {seniales.cantidad_cheques_pendientes === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ControlFondosTab

function fondoSNoLiquidosHoyLabel(monto) {
  if (monto > 0) {
    return {
      titulo: "Hay fondos administrados fuera de la liquidez inmediata",
      descripcion:
        "La posicion total supera la caja y los bancos porque existen valores aun en cartera o pendientes de acreditacion.",
    }
  }

  return {
    titulo: "Toda la posicion administrada esta disponible hoy",
    descripcion:
      "No hay diferencia material entre la liquidez inmediata y el total administrado en este corte.",
  }
}
