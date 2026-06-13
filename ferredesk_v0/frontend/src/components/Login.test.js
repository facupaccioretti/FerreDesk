import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

jest.mock(
  "react-router-dom",
  () => ({
    MemoryRouter: ({ children }) => <>{children}</>,
    useNavigate: () => jest.fn(),
    Navigate: ({ children }) => <>{children}</>,
    useLocation: () => ({ pathname: "/login" }),
  }),
  { virtual: true }
);

jest.mock("../hooks/useFerreDeskTheme", () => ({
  useFerreDeskTheme: () => ({
    tarjetaClara: "bg-white",
    botonManager: "bg-orange-600",
    azulSecundario: "text-blue-600",
  }),
}));

const { MemoryRouter } = require("react-router-dom");
const Login = require("./Login").default;

function setWindowLocation(url) {
  delete window.location;
  window.location = new URL(url);
  window.location.assign = jest.fn();
}

describe("Login", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.resetAllMocks();
  });

  async function renderLogin() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
  }

  test("en dominio publico usa login global y redirige al bridge del tenant", async () => {
    setWindowLocation("http://localhost:3000/login");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tenant: {
          url: "http://ferretest.lvh.me",
        },
        token_puente: {
          token: "token-puente-123",
        },
      }),
    });

    await renderLogin();

    const [usernameInput, passwordInput] = container.querySelectorAll("input");
    const form = container.querySelector("form");

    await act(async () => {
      usernameInput.value = "admin@ferretest.com";
      usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.value = "testpass123";
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(global.fetch).toHaveBeenCalledWith(
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
    expect(window.location.assign).toHaveBeenCalledWith(
      "http://ferretest.lvh.me/api/login-bridge/?token=token-puente-123"
    );
  });

  test("en subdominio mantiene login tenant directo como fallback", async () => {
    setWindowLocation("http://ferretest.lvh.me:3000/login");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
      }),
    });

    await renderLogin();

    const [usernameInput, passwordInput] = container.querySelectorAll("input");
    const form = container.querySelector("form");

    await act(async () => {
      usernameInput.value = "admin@ferretest.com";
      usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.value = "testpass123";
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/login/",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          username: "admin@ferretest.com",
          password: "testpass123",
        }),
      })
    );
    expect(window.location.assign).toHaveBeenCalledWith("/home");
  });
});
