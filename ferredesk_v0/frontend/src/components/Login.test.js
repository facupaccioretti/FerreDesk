import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockLoginTenantDirecto = jest.fn();
const mockLoginPublicoConBridge = jest.fn();
const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    MemoryRouter: ({ children }) => <>{children}</>,
    useNavigate: () => mockNavigate,
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

jest.mock("../utils/useAuthAPI", () => ({
  useAuthAPI: () => ({
    loginTenantDirecto: mockLoginTenantDirecto,
    loginPublicoConBridge: mockLoginPublicoConBridge,
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
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  test("en dominio publico usa el hook de bridge", async () => {
    setWindowLocation("http://localhost:3000/login");
    mockLoginPublicoConBridge.mockResolvedValue({
      redirectTo: "http://ferretest.lvh.me:3000/setup",
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

    expect(mockLoginPublicoConBridge).toHaveBeenCalledWith({
      email: "admin@ferretest.com",
      password: "testpass123",
    });
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("en subdominio redirige al dominio publico sin renderizar el formulario", async () => {
    setWindowLocation("http://ferretest.lvh.me:3000/login");

    await renderLogin();

    expect(container.querySelector("form")).toBeNull();
    expect(mockLoginTenantDirecto).not.toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith("http://lvh.me:3000/");
  });

  test("en staging publico renderiza el formulario y no redirige al root inexistente", async () => {
    setWindowLocation("https://staging.ferredesk.xyz/login");

    await renderLogin();

    expect(container.querySelector("form")).not.toBeNull();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test("en dominio publico ofrece ir a verificacion si el login falla por email pendiente", async () => {
    setWindowLocation("https://staging.ferredesk.xyz/login");
    mockLoginPublicoConBridge.mockRejectedValue(
      Object.assign(new Error("Tu cuenta todavia no verifico el email."), {
        errorCode: "pending_verification",
      })
    );

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

    const botonVerificacion = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("pantalla de verificacion")
    );

    expect(botonVerificacion).toBeTruthy();

    await act(async () => {
      botonVerificacion.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/pendiente-verificacion?email=admin%40ferretest.com&emailEnviado=false&origen=login"
    );
  });
});
