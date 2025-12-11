# ferredesk_backend/settings/dev.py

from .base import *
import os

DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Ruta al build del frontend en desarrollo
FRONTEND_BUILD_DIR = BASE_DIR.parent / "frontend" / "build"

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
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'FerreDesk',
        'USER': 'postgres',
        'PASSWORD': 'fercien',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# CORS & CSRF
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
