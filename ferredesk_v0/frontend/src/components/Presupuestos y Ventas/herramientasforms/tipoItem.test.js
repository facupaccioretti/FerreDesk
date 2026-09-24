import {
  crearItemDesdePromocion,
  crearItemDesdeBackend,
  resolverEleccionesDesdeComponentes,
  construirResumenPromocion,
} from "./tipoItem";

const promocionConGrupo = {
  id: 5,
  nombre: "Combo Vodka + Bebida a elección",
  precio_promocional: "15000.00",
  items: [
    { id: 1, stock_id: 100, codigo: "VODKA", denominacion: "Vodka", cantidad: 1 },
  ],
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
  ],
};

describe("crearItemDesdePromocion", () => {
  test("crea una fila de tipo promocion con el resumen de sus componentes elegidos", () => {
    const eleccionesGrupos = [{ grupo_id: 9, stock_id: 201 }];
    const item = crearItemDesdePromocion(promocionConGrupo, { eleccionesGrupos, cantidad: 3 });

    expect(item.tipo).toBe("promocion");
    expect(item.producto).toBeNull();
    expect(item.promocionId).toBe(5);
    expect(item.cantidad).toBe(3);
    expect(item.precioFinal).toBe(15000);
    expect(item.codigo).toBe("PROMO");
    expect(item.eleccionesGrupos).toEqual(eleccionesGrupos);
    expect(item.resumenComponentes).toBe("Vodka x1 · Fernet x2");
  });

  test("sin elegir el grupo todavia, el resumen marca la opcion como pendiente", () => {
    const item = crearItemDesdePromocion(promocionConGrupo, { eleccionesGrupos: [], cantidad: 1 });
    expect(item.resumenComponentes).toBe("Vodka x1 · Bebida (sin elegir) x2");
  });
});

describe("crearItemDesdeBackend con una linea de promocion ya vendida", () => {
  test("normaliza el snapshot congelado (componentes_promocion) sin volver a consultar la promocion", () => {
    const itemBackend = {
      id: 555,
      vdi_promocion: 5,
      promocion_nombre: "Combo Vodka + Bebida a elección",
      vdi_cantidad: 2,
      vdi_precio_unitario_final: "15000.00",
      componentes_promocion: [
        { stock_id: 100, denominacion: "Vodka", codigo: "VODKA", cantidad: "1.00" },
        { stock_id: 201, denominacion: "Fernet", codigo: "FERNET", cantidad: "2.00" },
      ],
    };

    const item = crearItemDesdeBackend(itemBackend, { aliMap: { 5: 21 } });

    expect(item.tipo).toBe("promocion");
    expect(item.id).toBe(555);
    expect(item.promocionId).toBe(5);
    expect(item.cantidad).toBe(2);
    expect(item.denominacion).toBe("Combo Vodka + Bebida a elección");
    expect(item.resumenComponentes).toBe("Vodka x1.00 · Fernet x2.00");
    // El snapshot vendido no trae la promocion completa: reconfigurar debe
    // ir a buscarla aparte, nunca asumir que esta disponible aca.
    expect(item.promocion).toBeNull();
  });

  test("un item con vdi_idsto normal sigue tomando la rama de producto (no se rompe nada existente)", () => {
    const item = crearItemDesdeBackend({
      id: 1,
      vdi_idsto: 10,
      vdi_detalle1: "Martillo",
      vdi_cantidad: 1,
      vdi_precio_unitario_final: 500,
    }, { aliMap: { 3: 0 } });

    expect(item.tipo).toBeUndefined();
    expect(item.producto).toBeTruthy();
  });
});

describe("resolverEleccionesDesdeComponentes", () => {
  test("reconstruye a que grupo pertenece cada componente vendido, para preseleccionar al reconfigurar", () => {
    const componentesVendidos = [
      { stock_id: 100, denominacion: "Vodka", codigo: "VODKA", cantidad: "1.00" },
      { stock_id: 201, denominacion: "Fernet", codigo: "FERNET", cantidad: "2.00" },
    ];

    const elecciones = resolverEleccionesDesdeComponentes(promocionConGrupo, componentesVendidos);

    expect(elecciones).toEqual([{ grupo_id: 9, stock_id: 201 }]);
  });

  test("si la alternativa vendida ya no existe en la promocion actual, ese grupo queda sin preseleccion", () => {
    const componentesVendidos = [{ stock_id: 999, denominacion: "Descontinuado", codigo: "OLD", cantidad: "2.00" }];
    const elecciones = resolverEleccionesDesdeComponentes(promocionConGrupo, componentesVendidos);
    expect(elecciones).toEqual([]);
  });
});

describe("construirResumenPromocion", () => {
  test("una promocion sin grupos arma el resumen solo con los componentes fijos", () => {
    const promocionSoloFija = {
      items: [
        { denominacion: "Vodka", codigo: "VODKA", cantidad: 1 },
        { denominacion: "Redbull", codigo: "REDBULL", cantidad: 2 },
      ],
      grupos: [],
    };
    expect(construirResumenPromocion(promocionSoloFija, [])).toBe("Vodka x1 · Redbull x2");
  });
});
