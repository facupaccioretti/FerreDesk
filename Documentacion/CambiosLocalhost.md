# Cambios para Solucionar Problema de CORS y Redirección

## Problema Original

El sistema FerreDesk tenía un problema de configuración que impedía el funcionamiento correcto del login y la navegación:

1. **Conflicto de puertos**: El frontend y backend estaban corriendo en el mismo puerto (8000)
2. **URLs hardcodeadas**: El código tenía URLs absolutas con `127.0.0.1:8000` en lugar de rutas relativas
3. **Problemas de CORS**: Las peticiones entre frontend y backend estaban siendo bloqueadas
4. **Redirección incorrecta**: Después del login, redirigía a `127.0.0.1:8000/home/` en lugar de `localhost:8000/home/`

## Solución Implementada

### 1. Separación de Puertos

**Problema**: Frontend y backend corriendo en puerto 8000
**Solución**: 
- Frontend: Puerto 3000
- Backend: Puerto 8000
- Proxy configurado para redirigir peticiones

### 2. URLs Hardcodeadas → Rutas Relativas

**Archivos modificados**:

#### `ferredesk_v0/frontend/src/components/Login.js`
```javascript
// ANTES
const response = await fetch('http://127.0.0.1:8000/api/login/', {
window.location.href = 'http://127.0.0.1:8000/home/';

// DESPUÉS
const response = await fetch('/api/login/', {
window.location.href = '/home/';
```

#### `ferredesk_v0/frontend/src/components/Register.js`
```javascript
// ANTES
const response = await fetch('http://127.0.0.1:8000/api/usuarios/register/', {

// DESPUÉS
const response = await fetch('/api/usuarios/register/', {
```

### 3. Configuración del Frontend

#### `ferredesk_v0/frontend/config-overrides.js` (NUEVO)
```javascript
module.exports = {
  webpack: function (config, env) {
    return config;
  },
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      // Configurar puerto 3000 para el frontend
      config.port = 3000;
      
      // Permitir cualquier host
      config.allowedHosts = "all";

      return config;
    };
  }
};
```

#### `ferredesk_v0/frontend/package.json`
```json
{
  "proxy": "http://localhost:8000",
  "scripts": {
    "start": "react-app-rewired start",
    "build": "react-app-rewired build",
    "test": "react-app-rewired test"
  }
}
```

### 4. Configuración del Backend

#### `ferredesk_v0/backend/ferredesk_backend/settings.py`
```python
# Configuración de CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
CORS_ALLOW_CREDENTIALS = True

# Configuración de CSRF
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

ALLOWED_HOSTS = ['localhost', '127.0.0.1']
```

## Cómo Funciona la Solución

### Flujo de Comunicación
1. **Frontend** corre en `http://localhost:3000`
2. **Backend** corre en `http://localhost:8000`
3. **Proxy** redirige automáticamente las peticiones `/api/*` del frontend al backend
4. **CORS** permite la comunicación entre los puertos
5. **Cookies de sesión** se comparten correctamente entre frontend y backend

### Ventajas de la Solución
- ✅ Separación clara entre frontend y backend
- ✅ URLs relativas más mantenibles
- ✅ Proxy automático para desarrollo
- ✅ Configuración estándar de React + Django
- ✅ Compatible con producción

## Comandos para Ejecutar

### 1. Instalar react-app-rewired (si no está instalado)
```bash
cd ferredesk_v0/frontend
npm install react-app-rewired --save-dev
```

### 2. Iniciar el Backend
```bash
cd ferredesk_v0/backend
python manage.py runserver
```

### 3. Iniciar el Frontend
```bash
cd ferredesk_v0/frontend
npm start
```

### 4. Acceder a la Aplicación
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/`

## Verificación

### Login Funcionando
1. Ir a `http://localhost:3000`
2. Ingresar credenciales
3. Debería redirigir a `http://localhost:3000/home/`
4. Dashboard debería cargar correctamente

### APIs Funcionando
- `/api/login/` - Login
- `/api/user/` - Información del usuario
- `/api/home/*` - APIs del dashboard

## Notas Importantes

1. **Puerto 3000**: Es el estándar para React en desarrollo
2. **Puerto 8000**: Es el estándar para Django
3. **Proxy**: Solo funciona en desarrollo, en producción se configura diferente
4. **CORS**: Necesario para permitir comunicación entre puertos
5. **Cookies**: Se comparten automáticamente gracias a `credentials: 'include'`

## Archivos Modificados

1. `ferredesk_v0/frontend/src/components/Login.js`
2. `ferredesk_v0/frontend/src/components/Register.js`
3. `ferredesk_v0/frontend/config-overrides.js` (NUEVO)
4. `ferredesk_v0/backend/ferredesk_backend/settings.py`

## Dependencias Agregadas

- `react-app-rewired`: Para modificar configuración de Create React App
- `corsheaders`: Ya estaba instalado, solo se configuró

---

**Fecha**: 8 de Noviembre de 2025
**Problema resuelto**: CORS, redirección y conflicto de puertos
**Estado**: ✅ Funcionando correctamente
