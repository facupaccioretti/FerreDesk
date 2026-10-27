import { useRef, useState } from "react"
import { useActivarPerfilesMutation } from "../../../domains/usuarios/usuariosMutations"

const CAMPOS_INICIALES = { nombre: "", contrasena: "", pin: "", confirmar_pin: "" }

function mensajeCampo(error, campo) {
  const valor = error?.fields?.[campo]
  if (Array.isArray(valor)) return valor[0]
  return typeof valor === "string" ? valor : ""
}

export default function ActivacionPerfiles() {
  const [abierto, setAbierto] = useState(false)
  const [campos, setCampos] = useState(CAMPOS_INICIALES)
  const enviandoRef = useRef(false)
  const mutation = useActivarPerfilesMutation()

  const cerrar = () => {
    if (mutation.isPending) return
    setCampos(CAMPOS_INICIALES)
    mutation.reset()
    setAbierto(false)
  }

  const cambiarCampo = (campo, valor) => {
    setCampos((actual) => ({ ...actual, [campo]: valor }))
    if (mutation.isError) mutation.reset()
  }

  const enviar = async (event) => {
    event.preventDefault()
    if (mutation.isPending || enviandoRef.current) return
    enviandoRef.current = true
    try {
      await mutation.mutateAsync(campos)
      setCampos(CAMPOS_INICIALES)
      setAbierto(false)
    } catch (_) {
      setCampos((actual) => ({ ...actual, contrasena: "", pin: "", confirmar_pin: "" }))
    } finally {
      enviandoRef.current = false
    }
  }

  return (
    <>
      <aside className="fixed bottom-4 right-4 z-40 max-w-sm rounded-xl border border-orange-200 bg-white p-4 shadow-2xl">
        <p className="text-sm font-bold text-slate-900">Perfiles operativos disponibles</p>
        <p className="mt-1 text-xs text-slate-600">Activalos cuando quieras identificar a cada persona por su PIN.</p>
        <button type="button" onClick={() => setAbierto(true)} className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Activar perfiles
        </button>
      </aside>

      {abierto ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="activar-perfiles-titulo">
          <form onSubmit={enviar} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <h2 id="activar-perfiles-titulo" className="text-xl font-bold text-slate-900">Activar perfiles</h2>
            <p className="mt-2 text-sm text-slate-600">La contrasena abre la cuenta compartida. Tu PIN de 6 digitos identificara al Dueno.</p>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Nombre del Dueno
                <input value={campos.nombre} onChange={(event) => cambiarCampo("nombre", event.target.value)} autoFocus className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                {mensajeCampo(mutation.error, "nombre") ? <span className="mt-1 block text-xs text-red-700">{mensajeCampo(mutation.error, "nombre")}</span> : null}
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Contrasena de la cuenta
                <input type="password" value={campos.contrasena} onChange={(event) => cambiarCampo("contrasena", event.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                {mensajeCampo(mutation.error, "contrasena") ? <span className="mt-1 block text-xs text-red-700">{mensajeCampo(mutation.error, "contrasena")}</span> : null}
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                PIN
                <input type="password" inputMode="numeric" maxLength={6} value={campos.pin} onChange={(event) => cambiarCampo("pin", event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                {mensajeCampo(mutation.error, "pin") ? <span className="mt-1 block text-xs text-red-700">{mensajeCampo(mutation.error, "pin")}</span> : null}
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Confirmar PIN
                <input type="password" inputMode="numeric" maxLength={6} value={campos.confirmar_pin} onChange={(event) => cambiarCampo("confirmar_pin", event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                {mensajeCampo(mutation.error, "confirmar_pin") ? <span className="mt-1 block text-xs text-red-700">{mensajeCampo(mutation.error, "confirmar_pin")}</span> : null}
              </label>
            </div>

            {mutation.isError && !Object.keys(mutation.error?.fields ?? {}).length ? (
              <p role="alert" className="mt-4 text-sm font-medium text-red-700">{mutation.error.message}</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={cerrar} disabled={mutation.isPending} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {mutation.isPending ? "Activando..." : "Activar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
