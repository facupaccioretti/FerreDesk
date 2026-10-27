import { useSessionCoordinator } from "../../../domains/session/sessionCoordinator"
import { useSessionUserQuery } from "../../../domains/session/useSessionUserQuery"
import ActivacionPerfiles from "./ActivacionPerfiles"

export default function PerfilOperativoGate({ children }) {
  const { capacidades, perfilesAdoptados } = useSessionUserQuery()
  const { operationalReady } = useSessionCoordinator()

  if (!operationalReady) return null

  return (
    <>
      {children}
      {!perfilesAdoptados && capacidades.puede_activar_perfiles ? <ActivacionPerfiles /> : null}
    </>
  )
}
