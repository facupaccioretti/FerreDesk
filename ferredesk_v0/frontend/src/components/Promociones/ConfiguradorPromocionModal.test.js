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

function radioPorLabel(texto) {
  const label = Array.from(document.body.querySelectorAll("label")).find(
    (l) => l.textContent.trim() === texto
  );
  return label ? label.querySelector('input[type="radio"]') : null;
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

  test("bloquea la confirmacion mientras falten grupos por elegir", async () => {
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

    // Elegir solo el primer grupo: sigue bloqueado por el segundo.
    // Se usa .click() (no setear .checked a mano) para pasar por el pipeline
    // nativo de eventos que React efectivamente observa en un radio controlado.
    const radioFernet = radioPorLabel("Fernet");
    expect(radioFernet).toBeTruthy();
    await act(async () => {
      radioFernet.click();
    });
    expect(radioFernet.checked).toBe(true);

    botonConfirmar = botonPorTexto("Confirmar");
    expect(botonConfirmar.disabled).toBe(true);

    // Elegir el segundo grupo: ahora se puede confirmar.
    const radioMani = radioPorLabel("Maní");
    await act(async () => {
      radioMani.click();
    });
    expect(radioMani.checked).toBe(true);

    botonConfirmar = botonPorTexto("Confirmar");
    expect(botonConfirmar.disabled).toBe(false);

    await act(async () => {
      botonConfirmar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [eleccionesGrupos, cantidad] = onConfirmar.mock.calls[0];
    expect(eleccionesGrupos).toEqual(
      expect.arrayContaining([
        { grupo_id: 9, stock_id: 201 },
        { grupo_id: 10, stock_id: 301 },
      ])
    );
    expect(cantidad).toBe(1);
  });

  test("en modo reconfigurar no muestra el campo de cantidad", async () => {
    await act(async () => {
      root.render(
        <ConfiguradorPromocionModal
          abierto
          modo="reconfigurar"
          promocion={promocionDosGrupos}
          eleccionesIniciales={[{ grupo_id: 9, stock_id: 200 }, { grupo_id: 10, stock_id: 300 }]}
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />
      );
    });

    expect(document.body.querySelector('input[type="number"]')).toBeNull();
    // Las elecciones iniciales ya vienen preseleccionadas: se puede confirmar directo.
    expect(botonPorTexto("Confirmar").disabled).toBe(false);
  });
});
