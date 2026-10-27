import { useState } from "react"
import { useCambiarPinPropioMutation } from "../../../domains/usuarios/usuariosMutations"

const INICIAL = { pin_actual: "", pin_nuevo: "", confirmar_pin: "" }

export default function CambiarPinModal({ abierto, onClose }) {
  const [campos, setCampos] = useState(INICIAL)
  const mutation = useCambiarPinPropioMutation()

  if (!abierto) return null

  const cerrar = () => {
    if (mutation.isPending) return
    setCampos(INICIAL)
    mutation.reset()
    onClose()
  }

  const actualizar = (campo, valor) => {
    setCampos((actual) => ({ ...actual, [campo]: valor.replace(/\D/g, "").slice(0, 6) }))
    if (mutation.isError) mutation.reset()
  }

  const enviar = async (event) => {
    event.preventDefault()
    if (mutation.isPending) return
    try {
      await mutation.mutateAsync(campos)
      onClose()
    } finally {
      setCampos(INICIAL)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="cambiar-pin-titulo">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="cambiar-pin-titulo" className="text-xl font-bold text-slate-900">Cambiar mi PIN</h2>
        <div className="mt-5 space-y-4">
          {[
            ["pin_actual", "PIN actual"],
            ["pin_nuevo", "PIN nuevo"],
            ["confirmar_pin", "Confirmar PIN"],
          ].map(([campo, label]) => (
            <label key={campo} className="block text-sm font-semibold text-slate-700">
              {label}
              <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={campos[campo]} onChange={(event) => actualizar(campo, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              {mutation.error?.fields?.[campo] ? <span className="mt-1 block text-xs text-red-700">{mutation.error.fields[campo][0] ?? mutation.error.fields[campo]}</span> : null}
            </label>
          ))}
        </div>
        {mutation.isError && !Object.keys(mutation.error?.fields ?? {}).length ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{mutation.error.message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={cerrar} disabled={mutation.isPending} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  )
}
