import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockBuscarProductoLookupRapidoActual = jest.fn();

jest.mock("../services/productoLookupApi", () => {
  const real = jest.requireActual("../services/productoLookupApi");
  return {
    ...real,
    buscarProductoLookupRapidoActual: (...args) => mockBuscarProductoLookupRapidoActual(...args),
  };
});

const { useProductoLookupRapido } = require("./useProductoLookupRapido");

function HookHarness({ params, onReady }) {
  const api = useProductoLookupRapido(params);

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

function setWindowLocation(url) {
  delete window.location;
  window.location = new URL(url);
}

describe("useProductoLookupRapido", () => {
  let container;
  let root;
  let queryClient;
  let api;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    setWindowLocation("http://tenant-a.lvh.me:3000/venta");
    api = null;
    mockBuscarProductoLookupRapidoActual.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  async function renderHarness(params = {}) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookHarness params={params} onReady={(value) => { api = value; }} />
        </QueryClientProvider>
      );
    });
  }

  test("dedupea requests concurrentes y reutiliza cache para el mismo codigo", async () => {
    let resolver;
    const producto = { id: 7, codvta: "POS001", deno: "Martillo" };
    mockBuscarProductoLookupRapidoActual.mockImplementation(
      () => new Promise((resolve) => { resolver = resolve; })
    );

    await renderHarness({ listaPrecioId: 0, modo: "venta" });

    let promesa1;
    let promesa2;
    await act(async () => {
      promesa1 = api.lookupProducto("POS001");
      promesa2 = api.lookupProducto("POS001");
    });

    expect(mockBuscarProductoLookupRapidoActual).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver(producto);
      await Promise.all([promesa1, promesa2]);
    });

    expect(api.obtenerDesdeCache("POS001")).toEqual(producto);

    let productoCacheado;
    await act(async () => {
      productoCacheado = await api.lookupProducto("POS001");
    });

    expect(productoCacheado).toEqual(producto);
    expect(mockBuscarProductoLookupRapidoActual).toHaveBeenCalledTimes(1);
  });

  test("incluye el tenant en la clave semantica del lookup", async () => {
    await renderHarness({ listaPrecioId: 3, modo: "venta" });
    const claveTenantA = api.construirQueryKey("POS001");

    setWindowLocation("http://tenant-b.lvh.me:3000/venta");
    await renderHarness({ listaPrecioId: 3, modo: "venta" });
    const claveTenantB = api.construirQueryKey("POS001");

    expect(claveTenantA[1]).toBe("tenant-a.lvh.me:3000");
    expect(claveTenantB[1]).toBe("tenant-b.lvh.me:3000");
    expect(claveTenantA).not.toEqual(claveTenantB);
  });
});
