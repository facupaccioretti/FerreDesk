import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockBuscarProductosLigeroActual = jest.fn();

jest.mock("../services/productoLookupApi", () => {
  const real = jest.requireActual("../services/productoLookupApi");
  return {
    ...real,
    buscarProductosLigeroActual: (...args) => mockBuscarProductosLigeroActual(...args),
  };
});

const { useProductoBusquedaLigera } = require("./useProductoBusquedaLigera");

function HookHarness({ params, onReady }) {
  const api = useProductoBusquedaLigera(params);

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useProductoBusquedaLigera", () => {
  let container;
  let root;
  let queryClient;
  let api;

  beforeEach(() => {
    jest.useFakeTimers();
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
    api = null;
    mockBuscarProductosLigeroActual.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    queryClient.clear();
    document.body.removeChild(container);
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  async function renderHarness(params) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookHarness params={params} onReady={(value) => { api = value; }} />
        </QueryClientProvider>
      );
    });
  }

  test("debouncea la busqueda y solo consulta el ultimo termino tipeado", async () => {
    mockBuscarProductosLigeroActual.mockResolvedValue([{ id: 1, codvta: "POS001" }]);

    await renderHarness({ termino: "", debounceMs: 250 });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockBuscarProductosLigeroActual).not.toHaveBeenCalled();

    await renderHarness({ termino: "ma", debounceMs: 250 });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockBuscarProductosLigeroActual).not.toHaveBeenCalled();

    await renderHarness({ termino: "marti", debounceMs: 250 });

    await act(async () => {
      jest.advanceTimersByTime(249);
    });
    expect(mockBuscarProductosLigeroActual).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockBuscarProductosLigeroActual).toHaveBeenCalledTimes(1);
    expect(mockBuscarProductosLigeroActual).toHaveBeenCalledWith(
      expect.objectContaining({ termino: "marti", limit: 20, signal: expect.any(AbortSignal) })
    );
  });

  test("aborta la request anterior al cambiar el termino e invalida el cache por prefijo", async () => {
    const senales = [];
    mockBuscarProductosLigeroActual.mockImplementation(({ termino, signal }) => {
      senales.push({ termino, signal });
      return new Promise(() => {});
    });

    await renderHarness({ termino: "mar", debounceMs: 10 });

    await act(async () => {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
    });

    await renderHarness({ termino: "marti", debounceMs: 10 });

    await act(async () => {
      jest.advanceTimersByTime(10);
      await Promise.resolve();
    });

    expect(senales).toHaveLength(2);
    expect(senales[0].signal.aborted).toBe(true);
    expect(senales[1].signal.aborted).toBe(false);

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    await act(async () => {
      api.invalidarCache();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['producto-busqueda-ligera', expect.any(String)],
    });
  });
});
