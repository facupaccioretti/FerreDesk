"""
Settings prod-like para reproducir staging/Render en local sin redeploy.

No usar en Render ni en clientes reales. Mantiene DEBUG=False y cookies HttpOnly,
pero permite HTTP local para lvh.me/localhost.
"""

from pathlib import Path
import os

import dj_database_url

from .base import *  # noqa: F401,F403


def _split_env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


DEBUG = False
ALLOW_INSECURE_PUBLIC_URLS = True
ARCA_PERMITIR_HOMOLOGACION_UI = env_bool("ARCA_PERMITIR_HOMOLOGACION_UI", True)

PRIMARY_DOMAIN = os.environ.get("PRIMARY_DOMAIN", "lvh.me").strip().lower()
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://lvh.me:8000").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", PUBLIC_BASE_URL).strip()

ALLOWED_HOSTS = _split_env_list(
    os.environ.get(
        "ALLOWED_HOSTS",
        "localhost,127.0.0.1,lvh.me,.lvh.me",
    )
)

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

FRONTEND_BUILD_DIR = Path(os.environ.get("FRONTEND_BUILD_DIR", BASE_DIR / "react_frontend"))
REACT_APP_DIR = FRONTEND_BUILD_DIR

TEMPLATES[0]["DIRS"] = [
    BASE_DIR / "templates",
]
if FRONTEND_BUILD_DIR.exists():
    TEMPLATES[0]["DIRS"].insert(0, FRONTEND_BUILD_DIR)

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = []
frontend_static_dir = FRONTEND_BUILD_DIR / "static"
if frontend_static_dir.exists():
    STATICFILES_DIRS.append(frontend_static_dir)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:fercien@localhost:5432/FerreDesk",
)
DATABASES = {
    "default": dj_database_url.config(default=DATABASE_URL, conn_max_age=600, conn_health_checks=True)
}
DATABASES["default"]["ENGINE"] = "django_tenants.postgresql_backend"
DATABASE_ROUTERS = ["django_tenants.routers.TenantSyncRouter"]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = _split_env_list(
    os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://lvh.me:3000,http://localhost:8000,http://127.0.0.1:8000,http://lvh.me:8000",
    )
)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://[\w\-]+\.localhost:3000$",
    r"^http://[\w\-]+\.localhost:8000$",
    r"^http://[\w\-]+\.lvh\.me:3000$",
    r"^http://[\w\-]+\.lvh\.me:8000$",
]

CSRF_TRUSTED_ORIGINS = _split_env_list(
    os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://*.localhost:3000,http://lvh.me:3000,http://*.lvh.me:3000,http://localhost:8000,http://127.0.0.1:8000,http://*.localhost:8000,http://lvh.me:8000,http://*.lvh.me:8000",
    )
)

SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN") or None
CSRF_COOKIE_DOMAIN = os.environ.get("CSRF_COOKIE_DOMAIN") or None

CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@ferredesk.local")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "prod-local-dummy")
RESEND_API_URL = os.environ.get("RESEND_API_URL", "https://api.resend.com/emails")
RESEND_TIMEOUT = int(os.environ.get("RESEND_TIMEOUT", "10"))

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
