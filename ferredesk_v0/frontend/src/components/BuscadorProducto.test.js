import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockUseProductoBusquedaLigera = jest.fn();

jest.mock("../hooks/useProductoBusquedaLigera", () => ({
  useProductoBusquedaLigera: (...args) => mockUseProductoBusquedaLigera(...args),
}));

const BuscadorProducto = require("./BuscadorProducto").default;
const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

describe("BuscadorProducto", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.__ferredesk_pos_baseline__ = {};

    mockUseProductoBusquedaLigera.mockReturnValue({
      resultados: [],
      cargando: false,
      actualizando: false,
      error: null,
      terminoDebounced: "",
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  test("muestra resultados del hook y selecciona el destacado con Enter", async () => {
    const onSelect = jest.fn();

    mockUseProductoBusquedaLigera.mockReturnValue({
      resultados: [
        { id: 1, codvta: "POS001", deno: "Martillo", stock_total: 8 },
        { id: 2, codvta: "POS002", deno: "Pinza", stock_total: 3 },
      ],
      cargando: false,
      actualizando: false,
      error: null,
      terminoDebounced: "mar",
    });

    await act(async () => {
      root.render(<BuscadorProducto onSelect={onSelect} />);
    });

    const input = container.querySelector("input");
    await act(async () => {
      setInputValue.call(input, "mar");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("Martillo");
    expect(container.textContent).toContain("Pinza");
    expect(container.textContent).toContain("Stock: 8");

    const primeraOpcion = container.querySelector('[role="option"]');

    await act(async () => {
      primeraOpcion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, codvta: "POS001", deno: "Martillo" })
    );
  });

  test("muestra error del hook cuando la busqueda falla", async () => {
    mockUseProductoBusquedaLigera.mockReturnValue({
      resultados: [],
      cargando: false,
      actualizando: false,
      error: new Error("fallo de prueba"),
      terminoDebounced: "ma",
    });

    await act(async () => {
      root.render(<BuscadorProducto onSelect={jest.fn()} />);
    });

    expect(container.textContent).toContain("Error: fallo de prueba");
  });

  test("no muestra ni selecciona resultados de otro termino", async () => {
    const onSelect = jest.fn();

    mockUseProductoBusquedaLigera.mockReturnValue({
      resultados: [{ id: 1, codvta: "PAL001", deno: "Pala", stock_total: 2 }],
      cargando: false,
      actualizando: false,
      error: null,
      terminoDebounced: "pala",
    });

    await act(async () => {
      root.render(<BuscadorProducto onSelect={onSelect} />);
    });

    const input = container.querySelector("input");
    await act(async () => {
      setInputValue.call(input, "tornillo");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
