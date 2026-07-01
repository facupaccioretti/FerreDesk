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
    getCookie.mockReturnValue("csrf-publico");

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

  test("normaliza slug manual a minusculas y guiones", async () => {
    await act(async () => {
      api.handleChange({ target: { name: "slug", value: " Mi Negocio++ " } });
    });

    expect(api.formData.slug).toBe("mi-negocio");
  });

  test("nombre no autocompleta ni dispara validacion de slug", async () => {
    await act(async () => {
      api.handleChange({ target: { name: "nombre", value: "Ferrecarlos" } });
    });

    expect(api.formData.slug).toBe("");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("slug se valida solo cuando lo pedis", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: "minegocio",
        disponible: true,
        dominio_sugerido: "minegocio.ferredesk.test",
      }),
    });

    await act(async () => {
      api.handleChange({ target: { name: "slug", value: "MiNegocio" } });
    });

    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await api.handleValidateSlug();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/public/onboarding/validar-slug/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "minegocio" }),
      })
    );
    expect(api.slugResult?.slug).toBe("minegocio");
  });

  test("submit revalida slug actual antes de registrar", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          slug: "minegocio",
          disponible: true,
          dominio_sugerido: "minegocio.ferredesk.test",
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
      api.handleChange({ target: { name: "slug", value: "MiNegocio" } });
      api.handleChange({ target: { name: "email_admin", value: "admin@ferreprueba17.com" } });
      api.handleChange({ target: { name: "password", value: "testpass123" } });
      api.handleChange({ target: { name: "confirmPassword", value: "testpass123" } });
    });

    await act(async () => {
      await api.handleSubmit({ preventDefault() {} });
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/public/onboarding/validar-slug/",
      expect.objectContaining({
        body: JSON.stringify({ slug: "minegocio" }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/registro-saas/",
      expect.objectContaining({
        body: JSON.stringify({
          nombre: "Ferre Prueba",
          slug: "minegocio",
          email_admin: "admin@ferreprueba17.com",
          password: "testpass123",
        }),
      })
    );
    expect(api.loadingRegistro).toBe(false);
    expect(api.solicitudId).toBe(17);
    expect(api.registroError).toContain("Solicitud #17");
  });
});
