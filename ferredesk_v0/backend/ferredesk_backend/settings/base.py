from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key")

SHARED_APPS = (
    'django_tenants',
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'tenants',
    'acceso_publico',
    'rest_framework',
    'django_filters',
    'django_extensions',
    'corsheaders',
    'axes',
)

TENANT_APPS = (
    # Auth y sesiones viven en tenant porque el usuario custom depende de Ferreteria,
    # que es un modelo de negocio tenant-only.
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'ferreapps.usuarios',
    'ferreapps.productos',
    'ferreapps.proveedores',
    'ferreapps.login',
    'ferreapps.clientes',
    'ferreapps.ventas',
    'ferreapps.reservas',
    'ferreapps.notas',
    'ferreapps.alertas',
    'ferreapps.informes',
    'ferreapps.compras',
    'ferreapps.cuenta_corriente',
    'ferreapps.caja',
    'ferreapps.sistema',
)

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'ferredesk_backend.utils.middlewares.HealthCheckBypassMiddleware',
    'django_tenants.middleware.main.TenantMainMiddleware',
    'ferredesk_backend.utils.middlewares.SuscripcionMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',
]

ROOT_URLCONF = 'ferredesk_backend.urls'
PUBLIC_SCHEMA_URLCONF = 'ferredesk_backend.urls_public'
TENANT_MODEL = 'tenants.EmpresaTenant'
TENANT_DOMAIN_MODEL = 'tenants.Dominio'
DATABASE_ROUTERS = ('django_tenants.routers.TenantSyncRouter',)
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True

# TEMPLATES — AHORA EN BASE.PY
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # dev y prod lo sobrescriben
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ferredesk_backend.wsgi.application'

# STATICFILES FINDERS
STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True


MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "usuarios.Usuario"
# En desarrollo mantenemos backend de consola para no depender de SMTP externo.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@ferredesk.local")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").strip()

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'EXCEPTION_HANDLER': 'ferredesk_backend.utils.exceptions.custom_exception_handler',
}

PRODUCTO_DENOMINACION_MAX_CARACTERES = 50
TAM_PAGINA_POR_DEFECTO = 10
TAM_PAGINA_MAXIMA = 200
IMPORTACION_LISTA_MAX_FILAS_SYNC = int(os.environ.get("IMPORTACION_LISTA_MAX_FILAS_SYNC", "5000"))
IMPORTACION_LISTA_MAX_BYTES_SYNC = int(os.environ.get("IMPORTACION_LISTA_MAX_BYTES_SYNC", str(5 * 1024 * 1024)))

# Django Axes
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(hours=1)
AXES_LOCKOUT_CALLABLE = None
