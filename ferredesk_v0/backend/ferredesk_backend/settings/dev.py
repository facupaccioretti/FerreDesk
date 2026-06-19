# ferredesk_backend/settings/dev.py

from .base import *
import os

DEBUG = True
ARCA_PERMITIR_HOMOLOGACION_UI = env_bool("ARCA_PERMITIR_HOMOLOGACION_UI", False)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".localhost", ".lvh.me"]
# SESSION_COOKIE_DOMAIN = ".localhost"

# Ruta al build del frontend en desarrollo
FRONTEND_BUILD_DIR = BASE_DIR.parent / "frontend" / "build"
# Directorio raíz del build de React que usan las vistas de serve_react_app
REACT_APP_DIR = FRONTEND_BUILD_DIR

TEMPLATES[0]["DIRS"] = [
    FRONTEND_BUILD_DIR,
    BASE_DIR / "templates",
]

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    FRONTEND_BUILD_DIR,
    FRONTEND_BUILD_DIR / "static",
]

# Base de datos local
DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend',
        'NAME': 'FerreDesk',
        'USER': 'postgres',
        'PASSWORD': 'fercien',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']

# CORS & CSRF
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://lvh.me:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://lvh.me:8000",
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://[a-z0-9-]+\.localhost:3000$",
    r"^http://[a-z0-9-]+\.localhost:8000$",
    r"^http://[a-z0-9-]+\.lvh\.me:3000$",
    r"^http://[a-z0-9-]+\.lvh\.me:8000$",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://*.localhost:3000",
    "http://lvh.me:3000",
    "http://*.lvh.me:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://*.localhost:8000",
    "http://lvh.me:8000",
    "http://*.lvh.me:8000",
]
