import { calcularImporteConDescuentos } from "./useCalculosFormulario";

const descuentos = {
  bonificacionGeneral: 10,
  descu1: 10,
  descu2: 20,
  descu3: 50,
};

describe("calcularImporteConDescuentos", () => {
  test("conserva intacto el importe de una promocion", () => {
    const item = { tipo: "promocion", bonificacion: 25 };

    expect(calcularImporteConDescuentos(item, 1000, descuentos)).toBe(1000);
  });

  test("aplica bonificacion y descuentos en cadena a un item comun", () => {
    const item = { bonificacion: 10 };

    expect(calcularImporteConDescuentos(item, 1000, descuentos)).toBeCloseTo(324);
  });
});
