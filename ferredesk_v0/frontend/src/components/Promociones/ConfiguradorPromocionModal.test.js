import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ConfiguradorPromocionModal from "./ConfiguradorPromocionModal";

// Headlessui Dialog usa un Portal a document.body, asi que las consultas del
// test van contra document.body en vez del contenedor de montaje.

const promocionDosGrupos = {
  id: 5,
  nombre: "Combo doble elección",
  items: [],
  grupos: [
    {
      id: 9,
      nombre: "Bebida",
      cantidad: 2,
      alternativas: [
        { id: 90, stock_id: 200, codigo: "REDBULL", denominacion: "Redbull" },
        { id: 91, stock_id: 201, codigo: "FERNET", denominacion: "Fernet" },
      ],
    },
    {
      id: 10,
      nombre: "Snack",
      cantidad: 1,
      alternativas: [
        { id: 92, stock_id: 300, codigo: "PAPAS", denominacion: "Papas fritas" },
        { id: 93, stock_id: 301, codigo: "MANI", denominacion: "Maní" },
      ],
    },
  ],
};

function botonPorTexto(texto) {
  return Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent.trim() === texto
  );
}

function inputCantidad(texto) {
  return document.body.querySelector(`[aria-label="Cantidad de ${texto}"]`);
}

async function cambiarCantidad(input, cantidad) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, cantidad);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("ConfiguradorPromocionModal", () => {
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
    // Limpiar cualquier portal de headlessui que haya quedado en el body.
    document.body.querySelectorAll('[id^="headlessui-portal-root"]').forEach((n) => n.remove());
  });

  test("bloquea la confirmacion hasta que cada grupo complete su cantidad", async () => {
    const onConfirmar = jest.fn();

    await act(async () => {
      root.render(
        <ConfiguradorPromocionModal
          abierto
          modo="agregar"
          promocion={promocionDosGrupos}
          onConfirmar={onConfirmar}
          onCancelar={() => {}}
        />
      );
    });

    let botonConfirmar = botonPorTexto("Confirmar");
    expect(botonConfirmar).toBeTruthy();
    expect(botonConfirmar.disabled).toBe(true);

    const inputRedbull = inputCantidad("Redbull");
    const inputFernet = inputCantidad("Fernet");
    const inputMani = inputCantidad("Maní");
    expect(inputRedbull).toBeTruthy();
    expect(inputFernet).toBeTruthy();
    expect(inputMani).toBeTruthy();

    await cambiarCantidad(inputRedbull, "1");

    botonConfirmar = botonPorTexto("Confirmar");
    expect(botonConfirmar.disabled).toBe(true);

    await cambiarCantidad(inputFernet, "1");
    await cambiarCantidad(inputMani, "1");

    botonConfirmar = botonPorTexto("Confirmar");
    expect(botonConfirmar.disabled).toBe(false);

    await act(async () => {
      botonConfirmar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [eleccionesGrupos, cantidad] = onConfirmar.mock.calls[0];
    expect(eleccionesGrupos).toEqual(
      expect.arrayContaining([
        { grupo_id: 9, stock_id: 200, cantidad: 1 },
        { grupo_id: 9, stock_id: 201, cantidad: 1 },
        { grupo_id: 10, stock_id: 301, cantidad: 1 },
      ])
    );
    expect(cantidad).toBe(1);
  });

  test("en modo reconfigurar precompleta las cantidades elegidas", async () => {
    await act(async () => {
      root.render(
        <ConfiguradorPromocionModal
          abierto
          modo="reconfigurar"
          promocion={promocionDosGrupos}
          eleccionesIniciales={[
            { grupo_id: 9, stock_id: 200, cantidad: 2 },
            { grupo_id: 10, stock_id: 300, cantidad: 1 },
          ]}
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />
      );
    });

    expect(inputCantidad("Redbull").value).toBe("2");
    expect(inputCantidad("Papas fritas").value).toBe("1");
    expect(botonPorTexto("Confirmar").disabled).toBe(false);
  });
});
