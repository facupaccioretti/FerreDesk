import { useSessionCoordinator } from "../../../domains/session/sessionCoordinator"
import { useSessionUserQuery } from "../../../domains/session/useSessionUserQuery"
import SelectorPerfil from "./SelectorPerfil"

export default function SessionTransitionOverlay() {
  const {
    bloqueada,
    cancelarCambioPerfil,
    modoIdentificacion,
    motivoIdentificacion,
    perfilAnteriorId,
    requiereReidentificacion,
    revalidarSesion,
    transitionError,
  } = useSessionCoordinator()
  const { motivoRequiereIdentificacion } = useSessionUserQuery()

  if (!bloqueada) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Transicion de sesion">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        {requiereReidentificacion ? (
          <>
            {transitionError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                <p>No se pudo validar la sesion operativa.</p>
                <button type="button" onClick={() => revalidarSesion().catch(() => {})} className="mt-2 font-semibold underline">Revalidar sesion</button>
              </div>
            ) : null}
            <SelectorPerfil
              modo={modoIdentificacion}
              perfilAnteriorId={perfilAnteriorId}
              motivo={motivoIdentificacion ?? motivoRequiereIdentificacion}
              onCancel={modoIdentificacion === "cambiar" ? cancelarCambioPerfil : null}
            />
          </>
        ) : transitionError ? (
          <div className="text-center" role="alert">
            <h2 className="text-lg font-bold text-slate-900">No se pudo validar la sesion</h2>
            <p className="mt-2 text-sm text-slate-600">Reintenta cuando recuperes la conexion.</p>
            <button type="button" onClick={() => revalidarSesion().catch(() => {})} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
              Revalidar sesion
            </button>
          </div>
        ) : (
          <div className="py-4 text-center" role="status" aria-live="polite">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-orange-600" />
            <p className="font-medium text-slate-800">Validando la sesion operativa...</p>
          </div>
        )}
      </div>
    </div>
  )
}
