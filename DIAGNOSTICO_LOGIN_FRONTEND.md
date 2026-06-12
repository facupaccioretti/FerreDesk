# Diagnóstico: Bucle de Login en Frontend Local Multi-tenant

Tras analizar la configuración del proyecto y el flujo de los componentes de React junto con el proxy y el backend, he identificado la causa exacta del bucle de redirección en el entorno local.

## 🎯 El Problema Principal: `SESSION_COOKIE_DOMAIN` y el navegador

La causa fundamental por la que la sesión no persiste en el frontend es que **el navegador está rechazando silenciosamente la cookie de sesión (`sessionid`) que envía Django**. 

### 📄 Archivo implicado: `ferredesk_v0/backend/ferredesk_backend/settings/dev.py`

En la línea 9 de `dev.py` se define:
```python
SESSION_COOKIE_DOMAIN = ".localhost"
```

### 🔬 ¿Por qué falla?
1. **Reglas de seguridad de cookies (RFC 6265):** Los navegadores modernos (Chrome, Firefox) tratan a `localhost` como un Dominio de Nivel Superior (TLD), igual que `.com` o `.org`.
2. **Rechazo estricto:** Por razones de seguridad (para evitar el "cookie poisoning"), los navegadores **prohíben** establecer cookies a nivel de un TLD. Cuando el backend envía el header `Set-Cookie: sessionid=...; Domain=.localhost; Path=/;`, el navegador lo considera inválido y **lo descarta**.
3. **El bucle observable:** 
   - Haces POST a `/api/login/` en `Login.js`.
   - Django valida todo bien y devuelve HTTP 200 con el `Set-Cookie` para `.localhost`.
   - Chrome rechaza la cookie.
   - `Login.js` redirige exitosamente a `/home/`.
   - `RutaPrivada.js` se monta e intenta hacer `fetch("/api/user/")`.
   - Como Chrome no guardó la cookie, el fetch sale sin sesión.
   - Django devuelve 403 (No autenticado).
   - `RutaPrivada.js` te expulsa de vuelta a `/login`.

### 🚨 Problema Arquitectónico Adicional (Aislamiento de Tenants)
Usar `SESSION_COOKIE_DOMAIN = ".localhost"` intenta que la cookie de sesión sea compartida entre todos los subdominios (todos los tenants). Dado que los usuarios en este sistema tienen un campo `Ferreteria` (tenant-specific), **no deberías compartir sesiones entre tenants**. La sesión de `ferretest` debe vivir solo en `ferretest.localhost`. Si eliminas esa línea, Django usará por defecto el dominio exacto del request, lo cual el navegador SÍ acepta y además garantiza aislamiento real de sesión por tenant.

---

## 🔍 Problema Secundario: Uso de `localhost` vs `ferretest.localhost`

Mencionaste que el error ocurre "intentando usar localhost:3000 o ferretest.localhost:3000".

### 📄 Archivo implicado: `ferredesk_v0/frontend/src/components/RutaPrivada.js`
Si entras explícitamente a `http://localhost:3000`, NUNCA vas a poder mantenerte logueado en la aplicación tenant debido a esta validación:
```javascript
const HOSTS_PUBLICOS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// ...
if (!estadoAcceso.hostTenantValido) {
    return <Navigate to="/" replace />;
}
```
Si navegas a `localhost:3000/login`, te logueas, y te redirige a `/home`, `RutaPrivada` detectará que `localhost` no es un host de tenant válido y te pateará a la ruta raíz `/` (o `/login`). **El flujo en local debe hacerse SIEMPRE usando un subdominio válido** (ej. `http://ferretest.localhost:3000`).

---

## 📡 Descartando otras hipótesis

1. **CORS / CSRF:** No son culpables. El frontend usa rutas relativas (`fetch('/api/login/')`), lo que significa que la petición sale hacia el servidor de desarrollo de React (puerto 3000). El archivo `setupProxy.js` intercepta la ruta y la envía al backend en el puerto 8000 con el host original (`ferretest.localhost`). Para el navegador, la petición es *Same-Origin*, por lo que las políticas CORS no se activan.
2. **Falta de `credentials: 'include'` en Login.js:** En `Login.js` el fetch no tiene este flag, pero como es una petición *Same-Origin* (relativa al proxy 3000), el comportamiento por defecto de la API Fetch (`credentials: 'same-origin'`) envía y procesa las cookies correctamente. (Aún así, es buena práctica agregarlo).

---

## 🛠️ Magnitud de la Solución
El arreglo es **pequeño y localizado** (literalmente comentar/borrar una línea en `dev.py`). 

### Correcciones requeridas (para cuando decidas implementar):
1. **Backend:** Eliminar `SESSION_COOKIE_DOMAIN = ".localhost"` de `dev.py`. Al quitarlo, Django asignará la cookie estrictamente al dominio de la petición (`ferretest.localhost`), que es aceptado por el navegador y aísla la sesión por tenant.
2. **Frontend (opcional pero recomendado):** Agregar explícitamente `credentials: "include"` o `"same-origin"` en los `fetch` de `Login.js` y `Register.js` para ser 100% explícitos, aunque el problema real es el bloqueo de la cookie por parte del navegador.
