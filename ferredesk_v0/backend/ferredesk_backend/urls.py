"""
URL configuration for ferredesk_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from ferreapps.productos.views import StockViewSet, ProveedorViewSet, StockProveViewSet, FamiliaViewSet, AlicuotaIVAViewSet, FerreteriaAPIView

router = DefaultRouter()
router.register(r'productos/stock', StockViewSet, basename='stock')
router.register(r'productos/proveedores', ProveedorViewSet, basename='proveedor')
router.register(r'productos/stockprove', StockProveViewSet, basename='stockprove')
router.register(r'productos/familias', FamiliaViewSet, basename='familia')
router.register(r'productos/alicuotasiva', AlicuotaIVAViewSet, basename='alicuotaiva')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('ferreapps.usuarios.urls')),
    path('api/clientes/', include('ferreapps.clientes.urls')),
    path('api/productos/', include('ferreapps.productos.urls')),
    path('api/', include('ferreapps.ventas.urls')),
    path('api/', include('ferreapps.alertas.urls')),
    path('api/', include('ferreapps.notas.urls')),
    path('api/', include('ferreapps.compras.urls')),
    path('api/informes/', include('ferreapps.informes.urls')),
    path('api/ferreteria/', FerreteriaAPIView.as_view(), name='ferreteria-api'),
]

# Configuración para servir archivos media y estáticos
# Siempre servir archivos estáticos, independientemente de DEBUG
# IMPORTANTE: Esto debe ir ANTES de incluir el login para que Django maneje las rutas estáticas
if settings.STATIC_URL and settings.STATIC_ROOT:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
if settings.MEDIA_URL and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Incluir el login AL FINAL para capturar solo las rutas del frontend
urlpatterns += [
    path('', include('ferreapps.login.urls')),
]
