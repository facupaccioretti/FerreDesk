import { useState } from "react"
import { usePerfilesSeleccionQuery } from "../../../domains/usuarios/usuariosQueries"
import { useSeleccionarPerfilMutation } from "../../../domains/usuarios/usuariosMutations"
import PinPad from "./PinPad"

export default function SelectorPerfil({ modo = "identificar", perfilAnteriorId, motivo, onCancel }) {
  const perfilesQuery = usePerfilesSeleccionQuery()
  const mutation = useSeleccionarPerfilMutation({ modo, perfilAnteriorId })
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(() => perfilAnteriorId ?? null)
  const perfiles = perfilesQuery.data ?? []
  const perfil = perfiles.find((item) => item.id === perfilSeleccionado) ?? null

  const titulo = modo === "cambiar" ? "Cambiar perfil" : "Identificar perfil"
  const detalle = motivo === "perfil_expirado_por_inactividad"
    ? "La identificacion vencio por inactividad. Ingresa nuevamente tu PIN."
    : motivo === "credencial_perfil_cambiada" || motivo === "perfil_invalido"
      ? "La sesion de perfil cambio. Selecciona un perfil habilitado."
      : "Selecciona quien va a operar FerreDesk."

  if (perfilesQuery.isLoading) {
    return <p role="status" className="py-8 text-center text-sm text-slate-600">Cargando perfiles...</p>
  }

  if (perfilesQuery.isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-medium text-red-700">No se pudieron cargar los perfiles.</p>
        <button type="button" onClick={() => perfilesQuery.refetch()} className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <section aria-labelledby="selector-perfil-titulo">
      <div className="mb-5 text-center">
        <h1 id="selector-perfil-titulo" className="text-xl font-bold text-slate-900">{titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">{detalle}</p>
      </div>

      <div className="mb-5 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {perfiles.map((item) => {
          const seleccionado = item.id === perfilSeleccionado
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPerfilSeleccionado(item.id)}
              disabled={mutation.isPending}
              aria-pressed={seleccionado}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${seleccionado ? "border-orange-500 bg-orange-50 text-orange-900" : "border-slate-300 bg-white text-slate-800 hover:border-orange-300"}`}
            >
              {item.etiqueta}
            </button>
          )
        })}
      </div>

      {perfil ? (
        <PinPad
          key={perfil.id}
          esperaHasta={perfil.espera_hasta}
          onSubmit={(pin) => mutation.mutateAsync({ perfilId: perfil.id, pin })}
        />
      ) : (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
          Elegi un perfil para ingresar el PIN.
        </p>
      )}
      {onCancel ? (
        <button type="button" onClick={onCancel} disabled={mutation.isPending} className="mt-4 w-full rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">
          Cancelar
        </button>
      ) : null}
    </section>
  )
}
