import React, { act } from "react"
import { createRoot } from "react-dom/client"

jest.mock("./useSessionUserQuery", () => ({
  useSessionUserQuery: () => ({ permisosEfectivos: ["ventas.ver", "ventas.crear"] }),
}))

const { usePermisos } = require("./usePermisos")

test("evalua solo los permisos efectivos de la sesion", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let permisos
  const container = document.createElement("div")
  const root = createRoot(container)

  function Probe() {
    permisos = usePermisos()
    return null
  }

  await act(async () => root.render(<Probe />))

  expect(permisos.tienePermiso("ventas.ver")).toBe(true)
  expect(permisos.tienePermiso("ventas.anular")).toBe(false)
  expect(permisos.tieneAlguno(["ventas.anular", "ventas.crear"])).toBe(true)
  expect(permisos.tieneTodos(["ventas.ver", "ventas.crear"])).toBe(true)

  act(() => root.unmount())
})
