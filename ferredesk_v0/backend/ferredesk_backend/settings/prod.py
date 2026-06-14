from .base import *
import os
import dj_database_url


def _split_env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = False

ALLOWED_HOSTS = _split_env_list(os.environ.get("ALLOWED_HOSTS", "")) + [
    ".railway.app",
    ".ferredesk.com",
    "localhost",
    "127.0.0.1",
]
SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN", None)

# Ruta donde Docker coloca el build del frontend (copiado por Dockerfile)
REACT_APP_DIR = os.path.join(BASE_DIR, 'react_frontend')

TEMPLATES[0]["DIRS"] = [
    REACT_APP_DIR,
    os.path.join(BASE_DIR, "templates"),
]

# Staticfiles
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

# Directorio de estaticos de React (apuntamos a la subcarpeta 'static')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'react_frontend', 'static'),
]

# Whitenoise sin manifest (mantiene nombres originales de React build)
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Base de datos desde variable de entorno
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get("DATABASE_URL"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
DATABASES['default']['ENGINE'] = 'django_tenants.postgresql_backend'
DATABASE_ROUTERS = ['django_tenants.routers.TenantSyncRouter']

# CORS & CSRF para subdominios del dominio principal
CSRF_TRUSTED_ORIGINS = _split_env_list(os.environ.get("CSRF_TRUSTED_ORIGINS", ""))
CORS_ALLOWED_ORIGINS = _split_env_list(os.environ.get("CORS_ALLOWED_ORIGINS", ""))

MAIN_DOMAIN = os.environ.get("MAIN_DOMAIN", "").strip()
CORS_ALLOWED_ORIGIN_REGEXES = []
if MAIN_DOMAIN:
    escaped_main_domain = MAIN_DOMAIN.replace(".", r"\.")
    CORS_ALLOWED_ORIGIN_REGEXES = [
        rf"^https://([a-z0-9-]+\.)*{escaped_main_domain}$",
    ]
