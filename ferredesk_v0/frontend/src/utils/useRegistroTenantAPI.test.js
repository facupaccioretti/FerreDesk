import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { getCookie } from "./csrf";

jest.mock("./csrf", () => ({
  getCookie: jest.fn(),
}));

const { useRegistroTenantAPI } = require("./useRegistroTenantAPI");

function HookHarness({ onReady }) {
  const api = useRegistroTenantAPI();

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useRegistroTenantAPI", () => {
  let container;
  let root;
  let api;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn();

    await act(async () => {
      root.render(<HookHarness onReady={(value) => { api = value; }} />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.resetAllMocks();
  });

  test("limpia loading y expone solicitud_id cuando registro-saas falla", async () => {
    getCookie.mockReturnValue("csrf-publico");
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          slug: "ferreprueba17",
          disponible: true,
          dominio_sugerido: "ferreprueba17.ferredesk.test",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          status: "error",
          message: "No se pudo completar el alta del negocio.",
          solicitud_id: 17,
          error_codigo: "provisioning_error",
        }),
      });

    await act(async () => {
      api.handleChange({ target: { name: "nombre", value: "Ferre Prueba" } });
      api.handleChange({ target: { name: "slug", value: "ferreprueba17" } });
      api.handleChange({ target: { name: "email_admin", value: "admin@ferreprueba17.com" } });
      api.handleChange({ target: { name: "password", value: "testpass123" } });
      api.handleChange({ target: { name: "confirmPassword", value: "testpass123" } });
    });

    await act(async () => {
      await api.handleValidateSlug();
    });

    await act(async () => {
      await api.handleSubmit({ preventDefault() {} });
    });

    expect(api.loadingRegistro).toBe(false);
    expect(api.solicitudId).toBe(17);
    expect(api.registroError).toContain("Solicitud #17");
  });
});
