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
    # ===== ADMINISTRACIÓN DE DJANGO =====
    path('admin/', admin.site.urls),
    
    # ===== APIs REST (MODULARES) =====
    path('api/usuarios/', include('ferreapps.usuarios.urls')),
    path('api/clientes/', include('ferreapps.clientes.urls')),
    path('api/productos/', include('ferreapps.productos.urls')),
    path('api/proveedores/', include('ferreapps.proveedores.urls')),
    path('api/', include('ferreapps.ventas.urls')),
    path('api/', include('ferreapps.alertas.urls')),
    path('api/', include('ferreapps.notas.urls')),
    path('api/', include('ferreapps.compras.urls')),
    path('api/informes/', include('ferreapps.informes.urls')),
    path('api/cuenta-corriente/', include('ferreapps.cuenta_corriente.urls')),
    path('api/ferreteria/', FerreteriaAPIView.as_view(), name='ferreteria-api'),
    
    # ===== AUTENTICACIÓN =====
    path('api/', include('ferreapps.login.urls')),  # Solo APIs de autenticación
]

# ===== ARCHIVOS MEDIA =====
if settings.MEDIA_URL and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# ===== ARCHIVOS DE LA RAÍZ DEL BUILD DE REACT =====
# favicon.ico, manifest.json, logo, robots.txt - no están en /static/
from django.http import FileResponse, Http404
import os

def serve_react_root_file(request, filename):
    """Sirve archivos de la raíz del build de React (favicon, manifest, etc)"""
    file_path = os.path.join(settings.REACT_APP_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        # Determinar content type
        content_types = {
            '.ico': 'image/x-icon',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
        }
        ext = os.path.splitext(filename)[1].lower()
        content_type = content_types.get(ext, 'application/octet-stream')
        return FileResponse(open(file_path, 'rb'), content_type=content_type)
    raise Http404(f"Archivo no encontrado: {filename}")

urlpatterns += [
    # Archivos específicos de la raíz del build de React
    path('favicon.ico', lambda r: serve_react_root_file(r, 'favicon.ico'), name='favicon'),
    path('manifest.json', lambda r: serve_react_root_file(r, 'manifest.json'), name='manifest'),
    path('robots.txt', lambda r: serve_react_root_file(r, 'robots.txt'), name='robots'),
    path('logo-arca.jpg', lambda r: serve_react_root_file(r, 'logo-arca.jpg'), name='logo'),
]

# ===== REACT SPA CATCH-ALL =====
# Whitenoise sirve los estáticos automáticamente via middleware.
# Django solo entrega el index.html para rutas de React Router.
urlpatterns += [
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='react_spa'),
]

