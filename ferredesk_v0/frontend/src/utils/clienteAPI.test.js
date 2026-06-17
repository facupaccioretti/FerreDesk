import {
  clienteAPI,
  esMetodoMutante,
  instalarFetchConCSRF,
  invalidarTokenCSRF,
  leerRespuestaAPI,
  normalizarErrorAPI,
  obtenerTokenCSRF,
} from './clienteAPI';

function respuestaJSON(body, opciones = {}) {
  return {
    ok: opciones.ok ?? true,
    status: opciones.status ?? 200,
    statusText: opciones.statusText ?? 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function respuestaHTML(html, opciones = {}) {
  return {
    ok: opciones.ok ?? false,
    status: opciones.status ?? 500,
    statusText: opciones.statusText ?? 'Server Error',
    headers: new Headers({ 'content-type': 'text/html' }),
    json: async () => {
      throw new Error('No es JSON');
    },
    text: async () => html,
  };
}

describe('clienteAPI', () => {
  beforeEach(() => {
    invalidarTokenCSRF();
    global.fetch = jest.fn();
  });

  test('detecta metodos mutantes', () => {
    expect(esMetodoMutante('POST')).toBe(true);
    expect(esMetodoMutante('patch')).toBe(true);
    expect(esMetodoMutante('GET')).toBe(false);
  });

  test('obtiene CSRF desde /api/csrf/ y lo cachea', async () => {
    global.fetch.mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-123' }));

    await expect(obtenerTokenCSRF()).resolves.toBe('token-123');
    await expect(obtenerTokenCSRF()).resolves.toBe('token-123');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/csrf/', expect.objectContaining({
      credentials: 'include',
      method: 'GET',
    }));
  });

  test('agrega X-CSRFToken en POST JSON', async () => {
    global.fetch
      .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-abc' }))
      .mockResolvedValueOnce(respuestaJSON({ ok: true }));

    await clienteAPI('/api/clientes/clientes/', {
      method: 'POST',
      body: { razon: 'Cliente Test' },
    });

    const llamada = global.fetch.mock.calls[1];
    expect(llamada[0]).toBe('/api/clientes/clientes/');
    expect(llamada[1].headers.get('X-CSRFToken')).toBe('token-abc');
    expect(llamada[1].headers.get('Content-Type')).toBe('application/json');
    expect(llamada[1].body).toBe(JSON.stringify({ razon: 'Cliente Test' }));
  });

  test('no agrega Content-Type para FormData', async () => {
    const formData = new FormData();
    formData.append('logo_arca', new Blob(['x']), 'logo.jpg');

    global.fetch
      .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-form' }))
      .mockResolvedValueOnce(respuestaJSON({ ok: true }));

    await clienteAPI('/api/productos/subir-logo-arca/', {
      method: 'POST',
      body: formData,
    });

    const llamada = global.fetch.mock.calls[1];
    expect(llamada[1].headers.get('X-CSRFToken')).toBe('token-form');
    expect(llamada[1].headers.has('Content-Type')).toBe(false);
    expect(llamada[1].body).toBe(formData);
  });

  test('maneja HTML 500 sin Unexpected token', async () => {
    const datos = await leerRespuestaAPI(respuestaHTML('<html>Error</html>'));
    const mensaje = normalizarErrorAPI({ status: 500, statusText: 'Server Error' }, datos);

    expect(datos).toEqual({ _tipo: 'no_json', texto: '<html>Error</html>' });
    expect(mensaje).toBe('El servidor tuvo un error interno. Intenta nuevamente o contacta soporte si persiste.');
  });

  test('normaliza CSRF 403 con mensaje limpio', () => {
    const mensaje = normalizarErrorAPI(
      { status: 403, statusText: 'Forbidden' },
      { detail: "CSRF Failed: CSRF token from the 'X-Csrftoken' HTTP header has incorrect length." }
    );

    expect(mensaje).toBe('No pudimos validar la sesion. Actualiza la pagina e intenta nuevamente.');
  });

  test('wrapper global sobrescribe CSRF manual incorrecto en requests mutantes same-origin', async () => {
    const fetchOriginal = jest.fn()
      .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-global' }))
      .mockResolvedValueOnce(respuestaJSON({ ok: true }));

    window.fetch = fetchOriginal;
    instalarFetchConCSRF();

    await window.fetch('/api/proveedores/', {
      method: 'POST',
      headers: { 'X-CSRFToken': 'token-viejo' },
      body: JSON.stringify({ razon: 'Proveedor Test' }),
    });

    expect(fetchOriginal).toHaveBeenNthCalledWith(1, '/api/csrf/', expect.objectContaining({
      credentials: 'include',
    }));
    expect(fetchOriginal.mock.calls[1][1].headers.get('X-CSRFToken')).toBe('token-global');
  });
});
