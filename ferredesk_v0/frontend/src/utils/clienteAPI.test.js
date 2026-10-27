import {
  clienteAPI,
  establecerPerfilEsperado,
  esMetodoMutante,
  esRutaMutanteExenta,
  instalarFetchConCSRF,
  desinstalarFetchConCSRF,
  invalidarTokenCSRF,
  leerRespuestaAPI,
  normalizarErrorAPI,
  obtenerTokenCSRF,
  suscribirAvisosSesion,
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

describe('clienteAPI y transporte HTTP', () => {
  beforeEach(() => {
    desinstalarFetchConCSRF();
    invalidarTokenCSRF();
    establecerPerfilEsperado(null);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    desinstalarFetchConCSRF();
  });

  test('detecta metodos mutantes', () => {
    expect(esMetodoMutante('POST')).toBe(true);
    expect(esMetodoMutante('patch')).toBe(true);
    expect(esMetodoMutante('PUT')).toBe(true);
    expect(esMetodoMutante('DELETE')).toBe(true);
    expect(esMetodoMutante('GET')).toBe(false);
    expect(esMetodoMutante('HEAD')).toBe(false);
    expect(esMetodoMutante('OPTIONS')).toBe(false);
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
    formData.append('certificado_arca', new Blob(['x']), 'certificado.pem');

    global.fetch
      .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-form' }))
      .mockResolvedValueOnce(respuestaJSON({ ok: true }));

    await clienteAPI('/api/ferreteria/', {
      method: 'POST',
      body: formData,
    });

    const llamada = global.fetch.mock.calls[1];
    expect(llamada[1].headers.get('X-CSRFToken')).toBe('token-form');
    expect(llamada[1].headers.has('Content-Type')).toBe(false);
    expect(llamada[1].body).toBe(formData);
  });

  describe('Inyeccion de X-Perfil-Esperado', () => {
    test('inyecta X-Perfil-Esperado en mutaciones de clienteAPI', async () => {
      establecerPerfilEsperado(42);
      global.fetch
        .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'csrf-1' }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }));

      await clienteAPI('/api/clientes/1/', { method: 'PUT', body: { nombre: 'A' } });
      await clienteAPI('/api/clientes/1/', { method: 'PATCH', body: { nombre: 'B' } });
      await clienteAPI('/api/clientes/1/', { method: 'DELETE' });

      expect(global.fetch.mock.calls[1][1].headers.get('X-Perfil-Esperado')).toBe('42');
      expect(global.fetch.mock.calls[2][1].headers.get('X-Perfil-Esperado')).toBe('42');
      expect(global.fetch.mock.calls[3][1].headers.get('X-Perfil-Esperado')).toBe('42');
    });

    test('omite X-Perfil-Esperado en clienteAPI cuando el metodo es GET', async () => {
      establecerPerfilEsperado(42);
      global.fetch.mockResolvedValueOnce(respuestaJSON({ ok: true }));

      await clienteAPI('/api/clientes/');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][1].headers.has('X-Perfil-Esperado')).toBe(false);
    });

    test('omite X-Perfil-Esperado cuando perfilEsperadoId es null', async () => {
      establecerPerfilEsperado(null);
      global.fetch
        .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'csrf-null' }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }));

      await clienteAPI('/api/clientes/', { method: 'POST', body: { nombre: 'C' } });

      expect(global.fetch.mock.calls[1][1].headers.has('X-Perfil-Esperado')).toBe(false);
    });

    test('inyecta X-Perfil-Esperado en fetch directo con URL string mutante', async () => {
      establecerPerfilEsperado(9);
      const fetchOriginal = jest.fn()
        .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-global' }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }));

      window.fetch = fetchOriginal;
      instalarFetchConCSRF();

      await window.fetch('/api/proveedores/', {
        method: 'POST',
        body: JSON.stringify({ razon: 'Proveedor Test' }),
      });

      expect(fetchOriginal.mock.calls[1][0]).toBe('/api/proveedores/');
      expect(fetchOriginal.mock.calls[1][1].headers.get('X-Perfil-Esperado')).toBe('9');
      expect(fetchOriginal.mock.calls[1][1].headers.get('X-CSRFToken')).toBe('token-global');
    });

    test('inyecta X-Perfil-Esperado cuando fetch recibe una instancia Request mutante (e.g. DELETE)', async () => {
      establecerPerfilEsperado(15);
      const fetchOriginal = jest.fn()
        .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-del' }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }));

      window.fetch = fetchOriginal;
      instalarFetchConCSRF();

      const requestInstance = new Request('/api/comprobantes/101/', {
        method: 'DELETE',
      });

      await window.fetch(requestInstance);

      expect(fetchOriginal).toHaveBeenCalledTimes(2);
      const llamadaMutante = fetchOriginal.mock.calls[1];
      // Verifica inyeccion en opciones.headers
      expect(llamadaMutante[1].headers.get('X-Perfil-Esperado')).toBe('15');
      expect(llamadaMutante[1].headers.get('X-CSRFToken')).toBe('token-del');
      // Verifica que la propia instancia Request tambien tenga el header si es accesible
      if (requestInstance.headers && typeof requestInstance.headers.get === 'function') {
        expect(requestInstance.headers.get('X-Perfil-Esperado')).toBe('15');
      }
    });

    test('omite X-Perfil-Esperado en fetch directo y Request cuando el metodo es GET', async () => {
      establecerPerfilEsperado(15);
      const fetchOriginal = jest.fn()
        .mockResolvedValueOnce(respuestaJSON({ ok: true }))
        .mockResolvedValueOnce(respuestaJSON({ ok: true }));

      window.fetch = fetchOriginal;
      instalarFetchConCSRF();

      await window.fetch('/api/productos/');
      await window.fetch(new Request('/api/productos/1/'));

      expect(fetchOriginal).toHaveBeenCalledTimes(2);
      expect(fetchOriginal.mock.calls[0][1]?.headers?.has?.('X-Perfil-Esperado')).toBeFalsy();
      expect(fetchOriginal.mock.calls[1][1]?.headers?.has?.('X-Perfil-Esperado')).toBeFalsy();
    });

    test('omite X-Perfil-Esperado en endpoints mutantes exentos', async () => {
      establecerPerfilEsperado(99);
      const rutasExentas = [
        '/api/login/',
        '/api/login-bridge/',
        '/api/auth/password-reset/',
        '/api/auth/password-reset/confirm/',
        '/api/usuarios/register/',
        '/api/usuarios/activar-perfiles/',
        '/api/usuarios/perfiles/identificar/',
        '/api/usuarios/perfiles/cambiar/',
        '/api/usuarios/perfiles/bloquear/',
        '/api/usuarios/pin-dueno/recuperacion/solicitar/',
        '/api/usuarios/pin-dueno/recuperacion/confirmar/',
      ];

      for (const ruta of rutasExentas) {
        expect(esRutaMutanteExenta(ruta)).toBe(true);

        global.fetch = jest.fn()
          .mockResolvedValueOnce(respuestaJSON({ csrfToken: 'token-exento' }))
          .mockResolvedValueOnce(respuestaJSON({ ok: true }));

        await clienteAPI(ruta, { method: 'POST', body: {} });
        const llamadaMutante = global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
        expect(llamadaMutante[1].headers.has('X-Perfil-Esperado')).toBe(false);
      }
    });
  });

  describe('Ramificacion exacta de codigos (Usuarios - Cierre del contrato HTTP.md §2)', () => {
    test('codigos clasificados como login disparan aviso global login (incluyendo 401 generico)', async () => {
      const listener = jest.fn();
      const desuscribir = suscribirAvisosSesion(listener);

      // 401 con code especificado
      global.fetch.mockResolvedValueOnce(respuestaJSON({
        code: 'cuenta_no_autenticada',
        message: 'No autenticado',
      }, { ok: false, status: 401 }));

      await clienteAPI('/api/user/').catch((e) => e);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        accion: 'login',
        code: 'cuenta_no_autenticada',
        status: 401,
      }));

      // 401 generico de DRF sin code
      global.fetch.mockResolvedValueOnce(respuestaJSON({
        detail: 'Authentication credentials were not provided.',
      }, { ok: false, status: 401 }));

      await clienteAPI('/api/user/').catch((e) => e);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
        accion: 'login',
        code: 'cuenta_no_autenticada',
        status: 401,
      }));

      desuscribir();
    });

    test('codigos clasificados como dura disparan aviso global dura', async () => {
      const listener = jest.fn();
      const desuscribir = suscribirAvisosSesion(listener);

      const codigosDura = [
        { code: 'perfil_invalido', status: 403 },
        { code: 'credencial_perfil_cambiada', status: 403 },
        { code: 'perfil_esperado_requerido', status: 409 },
        { code: 'perfil_desactualizado', status: 409 },
      ];

      for (const item of codigosDura) {
        global.fetch.mockResolvedValueOnce(respuestaJSON({
          code: item.code,
          message: 'Error de sesion',
        }, { ok: false, status: item.status }));

        await clienteAPI('/api/cualquiera/').catch((e) => e);
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
          accion: 'dura',
          code: item.code,
          status: item.status,
        }));
      }

      desuscribir();
    });

    test('codigo perfil_expirado_por_inactividad dispara aviso global suave', async () => {
      const listener = jest.fn();
      const desuscribir = suscribirAvisosSesion(listener);

      global.fetch.mockResolvedValueOnce(respuestaJSON({
        code: 'perfil_expirado_por_inactividad',
        message: 'Inactividad vencida',
      }, { ok: false, status: 403 }));

      await clienteAPI('/api/recurso/').catch((e) => e);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'suave',
        code: 'perfil_expirado_por_inactividad',
        status: 403,
      }));

      desuscribir();
    });

    test('codigos clasificados como revalidar disparan aviso global revalidar', async () => {
      const listener = jest.fn();
      const desuscribir = suscribirAvisosSesion(listener);

      const codigosRevalidar = [
        { code: 'perfil_requerido', status: 403 },
        { code: 'solo_dueno', status: 403 },
        { code: 'activacion_no_disponible', status: 403 },
        { code: 'adopcion_ya_realizada', status: 409 },
      ];

      for (const item of codigosRevalidar) {
        global.fetch.mockResolvedValueOnce(respuestaJSON({
          code: item.code,
          message: 'Revalidar sesion',
        }, { ok: false, status: item.status }));

        await clienteAPI('/api/recurso/').catch((e) => e);
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
          accion: 'revalidar',
          code: item.code,
          status: item.status,
        }));
      }

      desuscribir();
    });

    test('todos los codigos locales JAMAS disparan el coordinador global', async () => {
      const listener = jest.fn();
      const desuscribir = suscribirAvisosSesion(listener);

      const codigosLocales = [
        { code: 'permiso_insuficiente', status: 403 },
        { code: null, status: 403 }, // 403 legacy sin code
        { code: 'gestion_no_permitida', status: 403 },
        { code: 'permiso_no_otorgable', status: 403 },
        { code: 'identificacion_fallida', status: 403 },
        { code: 'perfil_con_historial', status: 409 },
        { code: 'perfil_ya_identificado', status: 409 },
        { code: 'pin_espera_activa', status: 429 },
        { code: 'pin_actual_incorrecto', status: 400 },
        { code: 'pin_invalido', status: 400 },
        { code: 'pin_confirmacion_distinta', status: 400 },
        { code: 'contrasena_incorrecta', status: 400 },
        { code: 'contrasena_espera_activa', status: 429 },
        { code: 'nombre_perfil_en_uso', status: 409 },
        { code: 'nombre_reservado', status: 400 },
        { code: 'permiso_desconocido', status: 400 },
        { code: 'perfil_no_encontrado', status: 404 },
        { code: 'token_recuperacion_invalido', status: 400 },
        { code: 'caja_ya_abierta', status: 409 },
        { code: 'caja_no_abierta', status: 409 },
        { code: 'caja_desactualizada', status: 409 },
        { code: 'caja_integridad_invalida', status: 409 },
        { code: 'payload_invalido', status: 400 },
      ];

      for (const item of codigosLocales) {
        global.fetch.mockResolvedValueOnce(respuestaJSON({
          code: item.code,
          message: 'Error local',
          fields: {},
        }, { ok: false, status: item.status }));

        const error = await clienteAPI('/api/recurso/').catch((e) => e);
        expect(error.status).toBe(item.status);
        expect(error.code).toBe(item.code);
      }

      // El listener del coordinador no debio recibir NI UNA llamada
      expect(listener).not.toHaveBeenCalled();
      desuscribir();
    });
  });

  describe('Manejo de errores y normalizacion de mensajes', () => {
    test('preserva Retry-After para esperas de PIN', async () => {
      const respuesta = respuestaJSON({
        code: 'pin_espera_activa',
        message: 'Espera activa',
        fields: {},
      }, { ok: false, status: 429 });
      respuesta.headers.set('Retry-After', '60');
      global.fetch.mockResolvedValueOnce(respuesta);

      const error = await clienteAPI('/api/usuarios/perfiles/identificar/').catch((e) => e);

      expect(error.retryAfter).toBe('60');
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
  });
});
