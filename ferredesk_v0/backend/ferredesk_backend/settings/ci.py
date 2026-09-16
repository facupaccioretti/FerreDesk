import os

import dj_database_url

from .base import *  # noqa: F403


DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".localhost", ".lvh.me", "testserver"]
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://lvh.me")
FRONTEND_URL = os.environ.get("FRONTEND_URL", PUBLIC_BASE_URL)

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ["DATABASE_URL"],
        conn_max_age=0,
        conn_health_checks=False,
    )
}
DATABASES["default"]["ENGINE"] = "django_tenants.postgresql_backend"
if test_database_name := os.environ.get("TEST_DATABASE_NAME"):
    DATABASES["default"]["TEST"] = {"NAME": test_database_name}
DATABASE_ROUTERS = ["django_tenants.routers.TenantSyncRouter"]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405
STATICFILES_DIRS = []
TEMPLATES[0]["DIRS"] = [BASE_DIR / "templates"]  # noqa: F405

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
