import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockLookupProducto = jest.fn();
const mockObtenerDesdeCache = jest.fn();

jest.mock("../../../hooks/useProductoLookupRapido", () => ({
  useProductoLookupRapido: () => ({
    lookupProducto: (...args) => mockLookupProducto(...args),
    obtenerDesdeCache: (...args) => mockObtenerDesdeCache(...args),
  }),
}));

const { useItemsGridState } = require("./useItemsGridState");

function HookHarness({ params, onReady }) {
  const api = useItemsGridState(params);

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useItemsGridState", () => {
  let container;
  let root;
  let api;

  const producto = {
    id: 10,
    codvta: "SCAN001",
    deno: "Producto Scanner",
    unidad: "UN",
    idaliiva: 3,
    precio_lista_0: 100,
    margen: 20,
    stock_total: 5,
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api = null;
    window.__ferredesk_pos_baseline__ = {};
    mockLookupProducto.mockReset();
    mockObtenerDesdeCache.mockReset();
    mockLookupProducto.mockResolvedValue(producto);
    mockObtenerDesdeCache.mockReturnValue(null);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  async function renderHarness() {
    await act(async () => {
      root.render(
        <HookHarness
          params={{
            initialItems: [],
            autoSumarDuplicados: "sumar",
            modo: "venta",
            readOnly: false,
            listaPrecioId: 0,
            listasPrecio: [],
            alicuotas: { 3: 21 },
          }}
          onReady={(value) => { api = value; }}
        />
      );
    });
  }

  test("un Enter seguido de blur no duplica el lookup efectivo y reaplicar el scan suma cantidad", async () => {
    await renderHarness();

    api.codigoRefs.current[0] = {
      focus: jest.fn(),
      setCustomValidity: jest.fn(),
      reportValidity: jest.fn(),
    };
    api.cantidadRefs.current[0] = { focus: jest.fn() };

    await act(async () => {
      api.handleRowChange(0, "codigo", "SCAN001");
    });

    const eventoEnter = { key: "Enter", preventDefault: jest.fn(), stopPropagation: jest.fn() };
    await act(async () => {
      await api.handleRowKeyDown(eventoEnter, 0, "codigo");
      await api.handleCodigoBlur(0);
    });

    expect(mockLookupProducto).toHaveBeenCalledTimes(1);
    expect(api.getRows()[0].cantidad).toBe(1);

    api.codigoRefs.current[1] = {
      focus: jest.fn(),
      setCustomValidity: jest.fn(),
      reportValidity: jest.fn(),
    };
    api.cantidadRefs.current[1] = { focus: jest.fn() };

    await act(async () => {
      api.handleRowChange(1, "codigo", "SCAN001");
    });

    await act(async () => {
      await api.handleRowKeyDown({ key: "Enter", preventDefault() {}, stopPropagation() {} }, 1, "codigo");
    });

    expect(api.getRows()[0].cantidad).toBe(2);
    expect(api.getRows().filter((row) => row.producto?.id === producto.id)).toHaveLength(1);
  });
});
