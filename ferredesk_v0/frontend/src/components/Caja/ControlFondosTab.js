"use client"

import { useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { queryKeys } from "../../core/query/queryKeys"
import { withQueryProfile } from "../../core/query/queryProfiles"
import { formatearMoneda } from "../../utils/formatters"
import { clienteAPI } from "../../utils/clienteAPI"
import usePortalTooltip from "../Presupuestos y Ventas/herramientasforms/usePortalTooltip"

const KPI_LABELS = {
  disponible_hoy: "Disponible hoy",
  caja: "Caja",
  bancos: "Bancos",
  cheques_en_cartera: "En cartera",
  pendiente_acreditacion: "Pend. acreditacion",
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

const EMPTY_OBJECT = {}
const EMPTY_ARRAY = []
const PIE_COLORS = ["#e8641a", "#2563eb", "#16a34a", "#7c3aed"]
const ALERTA_NO_LIQUIDEZ_RATIO = 0.7

function parseMonto(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function renderMonto(value) {
  return `$${formatearMoneda(parseMonto(value))}`
}

function getAyudaKpi(codigo) {
  switch (codigo) {
    case "disponible_hoy":
      return "Lo usable ahora: caja abierta y saldos bancarios ya acreditados."
    case "caja":
      return "Dinero disponible en caja activa del sistema."
    case "bancos":
      return "Fondos registrados en cuentas bancarias."
    case "cheques_en_cartera":
      return "Valores recibidos que todavia no entraron al banco."
    case "pendiente_acreditacion":
      return "Depositos realizados que aun no impactaron como liquidez."
    case "total_administrado":
      return "Suma lo disponible hoy mas cheques en cartera y montos que todavia esperan acreditacion."
    default:
      return "Detalle del indicador."
  }
}

function getAlertaNoLiquidez(noLiquido, totalAdministrado) {
  if (totalAdministrado <= 0 || noLiquido <= 0) return null

  const ratio = noLiquido / totalAdministrado
  if (ratio < ALERTA_NO_LIQUIDEZ_RATIO) return null

  return "La mayor parte del fondo administrado no esta disponible hoy."
}

const HelpTooltip = ({ label, text, placement = "top" }) => {
  const { TooltipPortal, triggerProps } = usePortalTooltip({ placement, offset: 10 })

  return (
    <>
      <button
        {...triggerProps}
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-400 transition-colors hover:border-[#e8641a] hover:text-[#e8641a] focus:outline-none focus:ring-2 focus:ring-[#e8641a]/30"
        aria-label={label}
      >
        ?
      </button>
      <TooltipPortal
        className="w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-slate-200/80 bg-white shadow-2xl"
        role="dialog"
      >
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">{text}</p>
        </div>
      </TooltipPortal>
    </>
  )
}

const KpiCell = ({ codigo, data, accent = false, onClick }) => {
  const esClickable = typeof onClick === "function"

  return (
    <div
      role={esClickable ? "button" : undefined}
      tabIndex={esClickable ? 0 : undefined}
      onClick={esClickable ? onClick : undefined}
      onKeyDown={
        esClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
        esClickable ? "cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#e8641a]/30" : "cursor-default"
      } ${
        accent ? "border-[#e8641a] bg-white" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            accent ? "text-[#e8641a]" : "text-slate-500"
          }`}
        >
          {KPI_LABELS[codigo] || codigo}
        </span>
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <HelpTooltip label={KPI_LABELS[codigo] || codigo} text={getAyudaKpi(codigo)} placement="bottom" />
        </span>
      </div>
      <span className="text-base font-bold leading-tight text-[#1e2d3d]">{renderMonto(data?.monto)}</span>
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null

  const { name, value } = payload[0]

  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#1e2d3d] shadow-md">
      {name}: <span className="font-bold">{renderMonto(value)}</span>
    </div>
  )
}

const ComponenteRow = ({ item, index, totalAdministrado, onClick, cajaAbierta = true }) => {
  const monto = parseMonto(item.monto)
  const porcentaje = totalAdministrado > 0 ? (monto / totalAdministrado) * 100 : 0
  const esLiquido = item.codigo === "caja" || item.codigo === "bancos"
  const esClickable = typeof onClick === "function"
  const notaCaja = item.codigo === "caja" && !cajaAbierta ? "sin sesion abierta" : null

  return (
    <tr
      className={`border-b border-slate-100 last:border-0 transition-colors ${
        index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
      } hover:bg-slate-100/60`}
    >
      <td className="px-3 py-2 text-[#1e2d3d]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
          />
          {esClickable ? (
            <button
              type="button"
              onClick={onClick}
              className="text-left text-sm font-medium transition-colors hover:text-[#e8641a]"
            >
              {COMPONENTE_LABELS[item.codigo] || item.codigo}
              {notaCaja && <span className="ml-2 text-xs font-normal text-slate-400">({notaCaja})</span>}
            </button>
          ) : (
            <span className="text-sm font-medium">
              {COMPONENTE_LABELS[item.codigo] || item.codigo}
              {notaCaja && <span className="ml-2 text-xs font-normal text-slate-400">({notaCaja})</span>}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-[#1e2d3d]">{renderMonto(monto)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#e8641a]"
              style={{ width: `${Math.min(porcentaje, 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-slate-500">{porcentaje.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold ${
            esLiquido ? "bg-[#1e2d3d] text-white" : "border border-[#e8641a] text-[#e8641a]"
          }`}
        >
          {esLiquido ? "Liquido" : "No liquido"}
        </span>
      </td>
    </tr>
  )
}

const ControlFondosTab = ({ onDrilldown, focusView = "resumen" }) => {
  const queryClient = useQueryClient()
  const desgloseRef = useRef(null)

  const {
    data: payload,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.resources.list("caja-control-fondos", { preset: "actual" }),
    queryFn: () => clienteAPI("/api/caja/control-fondos/"),
    ...withQueryProfile("expensiveReport", {
      staleTime: 15 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    }),
  })

  useEffect(() => {
    if (focusView === "composicion" && desgloseRef.current) {
      desgloseRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusView])

  const cargarControlFondos = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.resources.all("caja-control-fondos"),
    })
  }

  const kpis = useMemo(() => payload?.resumen_actual?.kpis || EMPTY_OBJECT, [payload])
  const composicionTotal = useMemo(
    () => payload?.composicion?.total_administrado?.componentes || EMPTY_ARRAY,
    [payload]
  )
  const seniales = useMemo(() => payload?.seniales || EMPTY_OBJECT, [payload])
  const drilldown = useMemo(() => payload?.drilldown || EMPTY_OBJECT, [payload])

  const disponibleHoyMonto = parseMonto(kpis.disponible_hoy?.monto)
  const totalAdministradoMonto = parseMonto(kpis.total_administrado?.monto)
  const fondosNoLiquidosHoy = totalAdministradoMonto - disponibleHoyMonto
  const alertaNoLiquidez = getAlertaNoLiquidez(fondosNoLiquidosHoy, totalAdministradoMonto)

  const pieData = useMemo(
    () =>
      composicionTotal
        .map((item) => ({
          name: COMPONENTE_LABELS[item.codigo] || item.codigo,
          value: parseMonto(item.monto),
        }))
        .filter((item) => item.value > 0),
    [composicionTotal]
  )

  const resumenKpis = useMemo(
    () => ORDEN_KPIS.map((codigo) => ({ codigo, data: kpis[codigo] })).filter((item) => item.data),
    [kpis]
  )

  const handleCardClick = (codigo) => {
    const metadata = drilldown[codigo]
    if (!metadata) return

    if (metadata.tab === "control_fondos" && metadata.vista_inicial === "composicion" && desgloseRef.current) {
      desgloseRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    if (typeof onDrilldown === "function") {
      onDrilldown(codigo, metadata)
    }
  }

  if (isLoading && !payload) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Cargando control de fondos...
      </div>
    )
  }

  if (error && !payload) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudo cargar Control de Fondos.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {resumenKpis.map(({ codigo, data }) => (
          <KpiCell
            key={codigo}
            codigo={codigo}
            data={data}
            accent={codigo === "disponible_hoy"}
            onClick={drilldown[codigo] ? () => handleCardClick(codigo) : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Composicion total</p>
            <HelpTooltip
              label="Composicion total"
              text="Muestra como se reparte el total administrado entre fondos liquidos y valores todavia no disponibles."
              placement="right"
            />
          </div>
          <div className="flex flex-1 items-center gap-3">
            <div className="h-[120px] w-[120px] shrink-0">
              <PieChart width={120} height={120}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </div>
            <ul className="min-w-0 flex flex-col gap-1.5">
              {pieData.map((item, i) => (
                <li key={item.name} className="flex items-center gap-1.5 truncate">
                  <span
                    className="inline-block size-2 shrink-0 rounded-sm"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate text-xs text-slate-600">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Liquido hoy</p>
                <HelpTooltip
                  label="Liquido hoy"
                  text="Es lo que puede usarse ahora mismo sin esperar acreditaciones ni mover cheques."
                />
              </div>
              <p className="mt-0.5 text-xl font-bold text-[#1e2d3d]">{renderMonto(disponibleHoyMonto)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Caja + bancos registrados</p>
            </div>

            <div
              className={`rounded-lg border bg-white px-3 py-2.5 ${
                fondosNoLiquidosHoy > 0 ? "border-[#e8641a]" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-widest ${
                    fondosNoLiquidosHoy > 0 ? "text-[#e8641a]" : "text-slate-500"
                  }`}
                >
                  No liquido hoy
                </p>
                <HelpTooltip
                  label="No liquido hoy"
                  text="Incluye cheques en cartera y montos pendientes de acreditacion. Siguen administrados, pero no disponibles."
                />
              </div>
              <p className="mt-0.5 text-xl font-bold text-[#1e2d3d]">{renderMonto(fondosNoLiquidosHoy)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {fondosNoLiquidosHoy > 0 ? "Cheques / pend. acreditacion" : "Sin fondos retenidos"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                <strong className="text-[#1e2d3d]">{seniales.cantidad_cuentas_activas || 0}</strong>{" "}
                cuenta{seniales.cantidad_cuentas_activas === 1 ? "" : "s"} activa
                {seniales.cantidad_cuentas_activas === 1 ? "" : "s"}
              </span>
              <span>
                <strong className="text-[#1e2d3d]">{seniales.cantidad_cheques_pendientes || 0}</strong>{" "}
                cheque{seniales.cantidad_cheques_pendientes === 1 ? "" : "s"} pendiente
                {seniales.cantidad_cheques_pendientes === 1 ? "" : "s"}
              </span>
              {alertaNoLiquidez && <span className="font-semibold text-[#e8641a]">· {alertaNoLiquidez}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <HelpTooltip
                label="Estado operativo"
                text="Estas senales ayudan a leer rapido cuantas cuentas y cheques siguen activos."
                placement="left"
              />
              <button
                type="button"
                onClick={cargarControlFondos}
                disabled={isFetching}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e2d3d] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetching ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={desgloseRef} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-[#1e2d3d]">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                  Componente
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                  Monto
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                  % del total
                </th>
                <th className="px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                  Tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {composicionTotal.map((item, index) => (
                <ComponenteRow
                  key={item.codigo}
                  item={item}
                  index={index}
                  totalAdministrado={totalAdministradoMonto}
                  cajaAbierta={Boolean(seniales.hay_caja_abierta)}
                  onClick={drilldown[item.codigo] ? () => handleCardClick(item.codigo) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ControlFondosTab
