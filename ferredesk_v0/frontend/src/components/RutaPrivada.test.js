import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

let mockPathnameActual = "/home";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock(
    "react-router-dom",
    () => ({
        Navigate: ({ to }) => <div>redirigido:{to}</div>,
        useLocation: () => ({ pathname: mockPathnameActual }),
    }),
    { virtual: true }
);

const RutaPrivada = require("./RutaPrivada").default;
const { esHostTenantValido } = require("./RutaPrivada");

function esperarMicrotareas() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function renderRutaPrivada({
    rutaInicial,
    hostnameActual = "ferretest.localhost",
    permitirSetupIncompleto = false,
}) {
    mockPathnameActual = rutaInicial;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <RutaPrivada
                hostnameActual={hostnameActual}
                permitirSetupIncompleto={permitirSetupIncompleto}
            >
                <div>contenido protegido</div>
            </RutaPrivada>
        );
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

describe("RutaPrivada", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = "";
    });

    test("detecta hosts tenant validos y publicos", () => {
        expect(esHostTenantValido("ferretest.localhost")).toBe(true);
        expect(esHostTenantValido("tenant.demo.example.com")).toBe(true);
        expect(esHostTenantValido("qa-a.staging.ferredesk.xyz")).toBe(true);
        expect(esHostTenantValido("staging.ferredesk.xyz")).toBe(false);
        expect(esHostTenantValido("preview.ferredesk.xyz")).toBe(false);
        expect(esHostTenantValido("localhost")).toBe(false);
        expect(esHostTenantValido("127.0.0.1")).toBe(false);
    });

    test("redirige a /setup cuando el tenant esta autenticado pero incompleto", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({ status: "success", user: { username: "admin@test.com" } }),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({
                    setup_completo: false,
                    campos_setup_faltantes: ["razon_social"],
                    no_configurada: true,
                }),
            });

        const vista = await renderRutaPrivada({ rutaInicial: "/home" });

        expect(vista.container.textContent).toContain("redirigido:/setup");
        expect(vista.container.textContent).not.toContain("contenido protegido");

        await vista.desmontar();
    });

    test("permite acceso normal cuando el tenant completo entra a ruta protegida", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({ status: "success", user: { username: "admin@test.com" } }),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({
                    setup_completo: true,
                    campos_setup_faltantes: [],
                    no_configurada: false,
                }),
            });

        const vista = await renderRutaPrivada({ rutaInicial: "/home" });

        expect(vista.container.textContent).toContain("contenido protegido");

        await vista.desmontar();
    });

    test("permite que un modulo maneje el setup incompleto dentro de su propia vista", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({ status: "success", user: { username: "admin@test.com" } }),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({
                    setup_completo: false,
                    campos_setup_faltantes: ["razon_social"],
                    no_configurada: true,
                }),
            });

        const vista = await renderRutaPrivada({
            rutaInicial: "/home",
            permitirSetupIncompleto: true,
        });

        expect(vista.container.textContent).toContain("contenido protegido");

        await vista.desmontar();
    });

    test("no toma localhost publico como host valido para rutas tenant", async () => {
        global.fetch = jest.fn();

        const vista = await renderRutaPrivada({
            rutaInicial: "/home",
            hostnameActual: "localhost",
        });

        expect(vista.container.textContent).toContain("redirigido:/");
        expect(global.fetch).not.toHaveBeenCalled();

        await vista.desmontar();
    });

    test("redirige a /home cuando el setup ya esta completo y el usuario entra a /setup", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({ status: "success", user: { username: "admin@test.com" } }),
            })
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({
                    setup_completo: true,
                    campos_setup_faltantes: [],
                    no_configurada: false,
                }),
            });

        const vista = await renderRutaPrivada({ rutaInicial: "/setup" });

        expect(vista.container.textContent).toContain("redirigido:/home");
        expect(vista.container.textContent).not.toContain("contenido protegido");

        await vista.desmontar();
    });
});
