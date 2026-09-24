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

  test("una fila de promocion se mapea solo a vdi_promocion/vdi_cantidad/elecciones_grupos", () => {
    // Shape que produce getItems() para una fila tipo:'promocion' (ver
    // useItemsGridState.js). El backend resuelve precio/costo/IVA/componentes
    // el mismo via expandir_item_promocion; mandar datos de producto aca
    // pisaria esa resolucion.
    const eleccionesGrupos = [{ grupo_id: 9, stock_id: 201 }];
    const item = mapearCamposItem({
      tipo: "promocion",
      vdi_promocion: 5,
      vdi_cantidad: 3,
      elecciones_grupos: eleccionesGrupos,
    }, 2);

    expect(item).toEqual({
      vdi_idve: null,
      vdi_orden: 3,
      vdi_promocion: 5,
      vdi_cantidad: 3,
      elecciones_grupos: eleccionesGrupos,
    });
    expect(item.vdi_idsto).toBeUndefined();
    expect(item.vdi_costo).toBeUndefined();
  });

  test("una fila de promocion sin grupos manda elecciones_grupos vacio", () => {
    const item = mapearCamposItem({ tipo: "promocion", vdi_promocion: 7, vdi_cantidad: 1 }, 0);
    expect(item.elecciones_grupos).toEqual([]);
  });
});
