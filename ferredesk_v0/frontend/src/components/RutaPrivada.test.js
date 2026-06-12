import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RutaPrivada, { esHostTenantValido } from "./RutaPrivada";

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
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <MemoryRouter initialEntries={[rutaInicial]}>
                <Routes>
                    <Route
                        path="/home"
                        element={
                            <RutaPrivada
                                hostnameActual={hostnameActual}
                                permitirSetupIncompleto={permitirSetupIncompleto}
                            >
                                <div>home protegida</div>
                            </RutaPrivada>
                        }
                    />
                    <Route
                        path="/setup"
                        element={
                            <RutaPrivada
                                hostnameActual={hostnameActual}
                                permitirSetupIncompleto={permitirSetupIncompleto}
                            >
                                <div>pantalla setup</div>
                            </RutaPrivada>
                        }
                    />
                    <Route path="/login" element={<div>pantalla login</div>} />
                    <Route path="/" element={<div>landing publica</div>} />
                </Routes>
            </MemoryRouter>
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

        expect(vista.container.textContent).toContain("pantalla setup");
        expect(vista.container.textContent).not.toContain("home protegida");

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

        expect(vista.container.textContent).toContain("home protegida");

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

        expect(vista.container.textContent).toContain("home protegida");

        await vista.desmontar();
    });

    test("no toma localhost publico como host valido para rutas tenant", async () => {
        global.fetch = jest.fn();

        const vista = await renderRutaPrivada({
            rutaInicial: "/home",
            hostnameActual: "localhost",
        });

        expect(vista.container.textContent).toContain("landing publica");
        expect(global.fetch).not.toHaveBeenCalled();

        await vista.desmontar();
    });
});
