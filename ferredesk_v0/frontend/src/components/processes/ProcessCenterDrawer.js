import { useProcessContext } from "../../context/ProcessContext"
import { useFerreDeskTheme } from "../../hooks/useFerreDeskTheme"

function ProcessMetric({ label, value }) {
  if (!value) {
    return null
  }

  return (
    <span className="text-xs text-slate-500">
      {label}: <span className="font-medium text-slate-700">{value}</span>
    </span>
  )
}

function ProcessStatus({ estado }) {
  const tonos =
    estado === "error"
      ? "bg-red-500 text-red-700"
      : estado === "completada"
        ? "bg-emerald-500 text-emerald-700"
        : "bg-orange-500 text-orange-700"

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium capitalize ${tonos.split(" ")[1]}`}>
      <span className={`h-2 w-2 rounded-full ${tonos.split(" ")[0]}`} />
      {estado}
    </span>
  )
}

function ProcessProgress({ proceso }) {
  if (typeof proceso.porcentaje !== "number") {
    return null
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Progreso</span>
        <span className="font-medium text-slate-700">{proceso.porcentaje}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-orange-500"
          style={{ width: `${Math.max(0, Math.min(100, proceso.porcentaje))}%` }}
        />
      </div>
    </div>
  )
}

function ProcessRow({ proceso }) {
  return (
    <article className="border-b border-slate-200 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            <h3 className="truncate text-sm font-semibold text-slate-900">{proceso.titulo}</h3>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {proceso.proveedorNombre || proceso.tipo.replaceAll("_", " ")}
          </p>
        </div>
        <ProcessStatus estado={proceso.estado} />
      </div>

      {proceso.mensaje && (
        <p className="mt-2 text-sm text-slate-600">{proceso.mensaje}</p>
      )}

      <ProcessProgress proceso={proceso} />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <ProcessMetric label="Procesados" value={proceso.registros_procesados} />
        <ProcessMetric label="Actualizados" value={proceso.registros_actualizados} />
        <ProcessMetric label="Creados" value={proceso.registros_creados} />
        <ProcessMetric label="Saltados" value={proceso.registros_saltados} />
      </div>
    </article>
  )
}

function ProcessSection({ title, emptyLabel, procesos }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </h3>
      <div className="rounded-none border-t border-slate-200">
        {procesos.length === 0 ? (
          <div className="py-4 text-sm text-slate-500">{emptyLabel}</div>
        ) : (
          procesos.map((proceso) => (
            <ProcessRow key={`${proceso.tipo}-${proceso.id}`} proceso={proceso} />
          ))
        )}
      </div>
    </section>
  )
}

export default function ProcessCenterDrawer() {
  const theme = useFerreDeskTheme()
  const { drawerOpen, procesosActivos, procesosRecientes, setDrawerOpen } = useProcessContext()

  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/20"
          onClick={() => setDrawerOpen(false)}
          aria-label="Cerrar panel de procesos"
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-slate-200 bg-white transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className={`flex items-center justify-between border-b border-slate-700 px-6 py-5 text-white bg-gradient-to-r ${theme.primario}`}>
          <div>
            <h2 className="text-lg font-semibold text-white">Centro de procesos</h2>
            <p className="text-sm text-slate-300">Seguimiento del tenant actual</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <ProcessSection
            title="Activos"
            emptyLabel="No hay procesos activos."
            procesos={procesosActivos}
          />
          <ProcessSection
            title="Recientes"
            emptyLabel="Todavia no hay procesos recientes."
            procesos={procesosRecientes}
          />
        </div>
      </aside>
    </>
  )
}
