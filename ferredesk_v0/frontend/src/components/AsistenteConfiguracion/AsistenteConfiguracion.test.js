import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import AsistenteConfiguracion from "./AsistenteConfiguracion";

const mockNavigate = jest.fn();

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../hooks/useFerreDeskTheme", () => ({
    useFerreDeskTheme: () => ({
        fondo: "bg-slate-900",
        patron: "pattern",
        overlay: "overlay",
    }),
}));

jest.mock("react-toastify", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

function esperarMicrotareas() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function renderAsistente() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(<AsistenteConfiguracion />);
        await esperarMicrotareas();
        await esperarMicrotareas();
    });

    return {
        container,
        desmontar: async () => {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        },
    };
}

describe("AsistenteConfiguracion", () => {
    let locationOriginal;

    beforeEach(() => {
        locationOriginal = window.location;
        delete window.location;
        window.location = new URL("http://ferretest.localhost/setup");
        window.location.assign = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = "";
        window.location = locationOriginal;
    });

    test("usa estado-setup como fuente de verdad y precarga la ferreteria incompleta sin redirigir", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    setup_completo: false,
                    campos_setup_faltantes: ["razon_social"],
                    no_configurada: false,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    nombre: "Ferreteria Test",
                    razon_social: "",
                    cuit_cuil: "",
                    situacion_iva: "RI",
                    direccion: "Calle 123",
                    telefono: "123456",
                    permitir_stock_negativo: true,
                }),
            });

        const vista = await renderAsistente();

        expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/ferreteria/estado-setup/", {
            credentials: "include",
        });
        expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/ferreteria/", {
            credentials: "include",
        });
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(vista.container.querySelector('input[name="nombre"]').value).toBe("Ferreteria Test");

        await act(async () => {
            vista.container.querySelector('button[type="button"]').click();
            await esperarMicrotareas();
        });

        expect(vista.container.querySelector('input[name="direccion"]').value).toBe("Calle 123");
        expect(vista.container.querySelector('input[name="telefono"]').value).toBe("123456");

        await vista.desmontar();
    });

    test("redirige a /home cuando el setup del tenant ya esta completo", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    setup_completo: true,
                    campos_setup_faltantes: [],
                    no_configurada: false,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    nombre: "Ferreteria Completa",
                }),
            });

        const vista = await renderAsistente();

        expect(window.location.assign).toHaveBeenCalledWith("/home");

        await vista.desmontar();
    });
});
