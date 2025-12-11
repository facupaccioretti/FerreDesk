# ferredesk_backend/settings/base.py

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-default-key')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Apps propias
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

    # Terceros
    'rest_framework',
    'django_filters',
    'django_extensions',
    'corsheaders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'ferreapps.clientes.middleware.CsrfExemptMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ferredesk_backend.urls'

WSGI_APPLICATION = 'ferredesk_backend.wsgi.application'

# REST FRAMEWORK
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
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'EXCEPTION_HANDLER': 'ferreapps.ventas.utils.ferre_exception_handler',
}

# INTERNACIONALIZACIÓN
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True

# MEDIA
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# PRIMARY KEY
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Negocio
PRODUCTO_DENOMINACION_MAX_CARACTERES = 50
TAM_PAGINA_POR_DEFECTO = 10
TAM_PAGINA_MAXIMA = 200
