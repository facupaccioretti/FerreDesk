# ferredesk_backend/settings/prod.py

from .base import *
import os
import dj_database_url

DEBUG = False

ALLOWED_HOSTS = ["*"]

# Ruta donde Docker coloca el build
FRONTEND_BUILD_DIR = os.path.join(BASE_DIR, "frontend_build")

TEMPLATES[0]["DIRS"] = [
    FRONTEND_BUILD_DIR,
    os.path.join(BASE_DIR, "templates"),
]

# Staticfiles
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

# En producción NO DEBE HABER STATICFILES_DIRS
STATICFILES_DIRS = []

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
