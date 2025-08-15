# Configuración para Producción - FerreDesk

## 🚀 Opción Recomendada: Servir React desde Django

Esta configuración es la más simple y eficiente para aplicaciones medianas.

### 1. Preparar el Build de React

```bash
cd ferredesk_v0/frontend
npm run build
```

Esto creará la carpeta `build/` con los archivos optimizados de React.

### 2. Configuración de Django para Producción

#### `ferredesk_v0/backend/ferredesk_backend/settings.py`

```python
# Configuración de producción
DEBUG = False
ALLOWED_HOSTS = ['tu-dominio.com', 'www.tu-dominio.com', 'localhost']

# Configuración de CORS para producción (si es necesario)
CORS_ALLOWED_ORIGINS = [
    "https://tu-dominio.com",
    "https://www.tu-dominio.com",
]

# Configuración de CSRF para producción
CSRF_TRUSTED_ORIGINS = [
    "https://tu-dominio.com",
    "https://www.tu-dominio.com",
]

# Configuración de cookies seguras
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SAMESITE = 'Lax'

# Configuración de archivos estáticos
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Configuración para servir React
STATICFILES_DIRS = [
    os.path.join(BASE_DIR.parent, 'frontend', 'build'),
    os.path.join(BASE_DIR.parent, 'frontend', 'build', 'static'),
]

REACT_APP_DIR = os.path.join(BASE_DIR.parent, 'frontend', 'build')
```

### 3. Configurar URLs para Producción

#### `ferredesk_v0/backend/ferredesk_backend/urls.py`

```python
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('ferreapps.usuarios.urls')),
    path('api/clientes/', include('ferreapps.clientes.urls')),
    path('api/productos/', include('ferreapps.productos.urls')),
    path('api/', include('ferreapps.ventas.urls')),
    path('api/', include('ferreapps.alertas.urls')),
    path('api/', include('ferreapps.notas.urls')),
    path('api/', include('ferreapps.compras.urls')),
    path('api/informes/', include('ferreapps.informes.urls')),
    path('api/ferreteria/', FerreteriaAPIView.as_view(), name='ferreteria-api'),
    path('', include('ferreapps.login.urls')),
]

# Configuración para servir archivos estáticos en producción
if not settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### 4. Configurar la Vista Index para React Router

#### `ferredesk_v0/backend/ferreapps/login/views.py`

```python
def index(request):
    # Si el usuario NO está autenticado y está intentando acceder al home, redirigir a la landing
    if not request.user.is_authenticated and request.path.startswith('/home'):
        with open(os.path.join(settings.REACT_APP_DIR, 'index.html'), 'rb') as f:
            content = f.read()
            # Insertar el meta tag de redirección después del <head>
            content = content.replace(b'<head>', b'<head><meta name="x-redirect" content="/">')
            return FileResponse(content, content_type='text/html')
    
    # Para todas las demás rutas, servir el index.html de React
    index_path = os.path.join(settings.REACT_APP_DIR, 'index.html')
    return FileResponse(open(index_path, 'rb'))
```

### 5. Comandos para Desplegar

```bash
# 1. Build de React
cd ferredesk_v0/frontend
npm run build

# 2. Recolectar archivos estáticos
cd ../backend
python manage.py collectstatic --noinput

# 3. Ejecutar migraciones
python manage.py migrate

# 4. Crear superusuario (si es necesario)
python manage.py createsuperuser

# 5. Iniciar servidor de producción
python manage.py runserver 0.0.0.0:8000
```

### 6. Configuración con Gunicorn (Recomendado)

#### Instalar Gunicorn
```bash
pip install gunicorn
```

#### Archivo `gunicorn.conf.py`
```python
bind = "0.0.0.0:8000"
workers = 3
timeout = 120
max_requests = 1000
max_requests_jitter = 100
```

#### Comando para iniciar
```bash
gunicorn ferredesk_backend.wsgi:application -c gunicorn.conf.py
```

### 7. Configuración con Nginx (Opcional pero Recomendado)

#### `/etc/nginx/sites-available/ferredesk`
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location /static/ {
        alias /ruta/a/ferredesk_v0/backend/staticfiles/;
    }

    location /media/ {
        alias /ruta/a/ferredesk_v0/backend/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔄 Alternativa: Servidores Separados

Si prefieres mantener frontend y backend separados en producción:

### Frontend (React)
```bash
# Build para producción
npm run build

# Servir con servidor web (Nginx, Apache, etc.)
# O usar servicios como Vercel, Netlify, etc.
```

### Backend (Django)
```python
# Configuración de CORS para servidor separado
CORS_ALLOWED_ORIGINS = [
    "https://tu-frontend.com",
    "https://www.tu-frontend.com",
]

CSRF_TRUSTED_ORIGINS = [
    "https://tu-frontend.com",
    "https://www.tu-frontend.com",
]
```

## 📋 Checklist de Producción

- [ ] Build de React generado
- [ ] DEBUG = False en settings.py
- [ ] ALLOWED_HOSTS configurado
- [ ] CORS configurado para producción
- [ ] CSRF configurado para producción
- [ ] Archivos estáticos recolectados
- [ ] Migraciones ejecutadas
- [ ] Superusuario creado
- [ ] Servidor de producción configurado
- [ ] SSL/HTTPS configurado (recomendado)
- [ ] Backup de base de datos configurado

## 🛡️ Consideraciones de Seguridad

1. **HTTPS**: Siempre usar HTTPS en producción
2. **Variables de entorno**: Usar archivo .env para configuraciones sensibles
3. **Base de datos**: Usar PostgreSQL o MySQL en lugar de SQLite
4. **Logs**: Configurar logging apropiado
5. **Backup**: Configurar backup automático de la base de datos

## 📊 Monitoreo

- Configurar logs de acceso y errores
- Monitorear uso de recursos
- Configurar alertas para errores críticos
- Backup automático de base de datos

---

**Nota**: La configuración actual de desarrollo (puertos separados, proxy, CORS) **NO se usa en producción**. En producción todo se sirve desde un solo servidor Django.
