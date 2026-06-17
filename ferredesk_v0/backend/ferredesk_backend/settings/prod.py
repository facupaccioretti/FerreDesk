from .base import *
import os
import re
import dj_database_url
from urllib.parse import urlparse
from django.core.exceptions import ImproperlyConfigured


def _split_env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


def _domain_from_url(url):
    if not url:
        return ""
    parsed = urlparse(url)
    return (parsed.hostname or "").strip().lower()


DEBUG = False

PRIMARY_DOMAIN = (
    os.environ.get("PRIMARY_DOMAIN", "").strip().lower()
    or _domain_from_url(os.environ.get("PUBLIC_BASE_URL", ""))
    or _domain_from_url(os.environ.get("FRONTEND_URL", ""))
)

ALLOWED_HOSTS = _split_env_list(os.environ.get("ALLOWED_HOSTS", "")) + [
    ".onrender.com",
    "localhost",
    "127.0.0.1",
]
if PRIMARY_DOMAIN:
    ALLOWED_HOSTS.extend([PRIMARY_DOMAIN, f".{PRIMARY_DOMAIN}"])
SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN", None)
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Ruta donde Docker coloca el build del frontend (copiado por Dockerfile)
REACT_APP_DIR = os.path.join(BASE_DIR, "react_frontend")

TEMPLATES[0]["DIRS"] = [
    REACT_APP_DIR,
    os.path.join(BASE_DIR, "templates"),
]

# Staticfiles
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

# Directorio de estaticos de React (apuntamos a la subcarpeta 'static')
STATICFILES_DIRS = [
    os.path.join(REACT_APP_DIR, "static"),
]

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL")
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))

_email_vars_requeridas = {
    "EMAIL_HOST": EMAIL_HOST,
    "EMAIL_HOST_USER": EMAIL_HOST_USER,
    "EMAIL_HOST_PASSWORD": EMAIL_HOST_PASSWORD,
    "DEFAULT_FROM_EMAIL": DEFAULT_FROM_EMAIL,
}
_faltantes = [clave for clave, valor in _email_vars_requeridas.items() if not valor]
if _faltantes:
    raise ImproperlyConfigured(
        f"Variables de email requeridas en produccion: {', '.join(_faltantes)}"
    )

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

frontend_url = os.environ.get("FRONTEND_URL", "").strip()
CORS_ALLOWED_ORIGINS = [frontend_url] if frontend_url else []

CORS_ALLOWED_ORIGIN_REGEXES = []
if PRIMARY_DOMAIN:
    domain_pattern = re.escape(PRIMARY_DOMAIN)
    CORS_ALLOWED_ORIGIN_REGEXES.append(rf"^https://[\w\-]+\.{domain_pattern}$")

# Seguridad de cookies en producción
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
