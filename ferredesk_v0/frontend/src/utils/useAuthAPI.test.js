import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { getCookie } from "./csrf";

jest.mock("./csrf", () => ({
  getCookie: jest.fn(),
}));

const { useAuthAPI } = require("./useAuthAPI");

function setWindowLocation(url) {
  delete window.location;
  window.location = new URL(url);
}

function HookHarness({ onReady }) {
  const api = useAuthAPI();

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useAuthAPI", () => {
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

  test("loginTenantDirecto usa POST JSON con sesiÃ³n", async () => {
    setWindowLocation("http://ferretest.lvh.me:3000/login");
    getCookie.mockReturnValue("csrf-local");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success" }),
    });

    let resultado;
    await act(async () => {
      resultado = await api.loginTenantDirecto({
        username: "admin@ferretest.com",
        password: "testpass123",
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/login/",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRFToken": "csrf-local",
        }),
        body: JSON.stringify({
          username: "admin@ferretest.com",
          password: "testpass123",
        }),
      })
    );
    expect(resultado).toEqual({ redirectTo: "/home" });
  });

  test("loginPublicoConBridge consume el token puente por POST y nunca en query string", async () => {
    setWindowLocation("http://localhost:3000/login");
    getCookie.mockReturnValue("csrf-publico");
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tenant: { url: "http://ferretest.lvh.me" },
          token_puente: { token: "token-puente-123" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "csrf-tenant" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirect_to: "/setup" }),
      });

    let resultado;
    await act(async () => {
      resultado = await api.loginPublicoConBridge({
        email: "admin@ferretest.com",
        password: "testpass123",
      });
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/public/acceso/login/",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "admin@ferretest.com",
          password: "testpass123",
        }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://ferretest.lvh.me:3000/api/csrf/",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "http://ferretest.lvh.me:3000/api/login-bridge/",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRFToken": "csrf-tenant",
        }),
        body: JSON.stringify({
          token: "token-puente-123",
        }),
      })
    );
    expect(resultado).toEqual({
      redirectTo: "http://ferretest.lvh.me:3000/setup",
    });
  });
});
