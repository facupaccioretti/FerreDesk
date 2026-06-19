import { useProcessContext } from "../../context/ProcessContext"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

function obtenerTextoEstado(cantidad) {
  if (cantidad === 1) {
    return "1 proceso critico en curso"
  }

  return `${cantidad} procesos criticos en curso`
}

export default function GlobalProcessBanner() {
  const theme = useFerreDeskTheme()
  const { procesosActivos, setDrawerOpen } = useProcessContext()

  const procesosCriticos = procesosActivos.filter(
    (proceso) => proceso.impacto_operativo === "critico"
  )

  if (procesosCriticos.length === 0) {
    return null
  }

  const principal = procesosCriticos[0]
  const mensajeNormalizado = (principal.mensaje || "").trim()
  const tituloNormalizado = (principal.titulo || "").trim()
  const mensajeReducido =
    mensajeNormalizado &&
    tituloNormalizado &&
    mensajeNormalizado.toLowerCase().startsWith(tituloNormalizado.toLowerCase())
      ? mensajeNormalizado.slice(tituloNormalizado.length).trim().replace(/^[-–,:]\s*/, "")
      : mensajeNormalizado
  const detalle =
    mensajeReducido || "Evita operar ventas, compras, presupuestos y productos hasta que finalice."

  return (
    <div className="border-b border-orange-200 bg-orange-50/80">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-orange-500" />
          <p className="truncate text-sm text-slate-700">
            <span className="mr-3 font-semibold uppercase tracking-wide text-orange-700">
              {obtenerTextoEstado(procesosCriticos.length)}
            </span>
            <span className="font-medium text-slate-900">{principal.titulo}</span>
            <span className="text-slate-600"> {detalle}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`${theme.botonPrimario} shrink-0 rounded-md px-3 py-1 text-sm shadow-none hover:shadow-none`}
        >
          Ver estado
        </button>
      </div>
    </div>
  )
}
