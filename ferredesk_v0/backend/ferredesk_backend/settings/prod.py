# ferredesk_backend/settings/prod.py

from .base import *
import os
import dj_database_url

DEBUG = False

ALLOWED_HOSTS = ["*"]

# Ruta donde Docker coloca el build del frontend (copiado por Dockerfile)
REACT_APP_DIR = os.path.join(BASE_DIR, 'react_frontend')

TEMPLATES[0]["DIRS"] = [
    REACT_APP_DIR,
    os.path.join(BASE_DIR, "templates"),
]

# Staticfiles
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

# Directorio de estáticos de React (apuntamos a la subcarpeta 'static')
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

# CORS & CSRF para producción interna/local
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

