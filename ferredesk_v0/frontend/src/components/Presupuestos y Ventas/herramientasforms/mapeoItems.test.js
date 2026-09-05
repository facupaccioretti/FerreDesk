import { mapearCamposItem } from "./mapeoItems";

describe("mapearCamposItem", () => {
  test.each([undefined, null, "", "   ", 0, "0", "0.00"])(
    "normaliza %p sin perder el producto",
    (precioFinal) => {
      const item = mapearCamposItem({
        producto: { id: 10, idaliiva: 3 },
        precioFinal,
        cantidad: 2,
        denominacion: "Producto sin cargo",
      }, 0);

      expect(item.vdi_idsto).toBe(10);
      expect(Number(item.vdi_precio_unitario_final)).toBe(0);
      expect(item.vdi_cantidad).toBe(2);
    }
  );

  test("conserva un valor invalido para que el backend lo rechace", () => {
    const item = mapearCamposItem({
      precioFinal: "abc",
      denominacion: "Item invalido",
    }, 0);

    expect(item.vdi_precio_unitario_final).toBe("abc");
  });
});
