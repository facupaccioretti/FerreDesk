from .base import *
import os
import dj_database_url


def _split_env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = False

ALLOWED_HOSTS = _split_env_list(os.environ.get("ALLOWED_HOSTS", "")) + [
    ".onrender.com",
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
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Storage - Cloudflare R2 (S3-compatible)
AWS_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
AWS_S3_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL')
AWS_S3_REGION_NAME = 'auto'
AWS_S3_ADDRESSING_STYLE = 'path'
AWS_QUERYSTRING_AUTH = False  # archivos públicos; cambiar a True si son privados
AWS_S3_FILE_OVERWRITE = False  # evita colisiones de nombres

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
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _split_env_list(os.environ.get("CSRF_TRUSTED_ORIGINS", ""))
CORS_ALLOWED_ORIGINS = [os.getenv("FRONTEND_URL", "")]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://[\w\-]+\.ferredesk\.com$",
]

# Seguridad de cookies en producción
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
