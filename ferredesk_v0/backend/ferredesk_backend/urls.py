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
from django.http import FileResponse, Http404
from rest_framework.routers import DefaultRouter
from ferreapps.productos.views import StockViewSet, ProveedorViewSet, StockProveViewSet, FamiliaViewSet, AlicuotaIVAViewSet, FerreteriaAPIView
import os

router = DefaultRouter()
router.register(r'productos/stock', StockViewSet, basename='stock')
router.register(r'productos/proveedores', ProveedorViewSet, basename='proveedor')
router.register(r'productos/stockprove', StockProveViewSet, basename='stockprove')
router.register(r'productos/familias', FamiliaViewSet, basename='familia')
router.register(r'productos/alicuotasiva', AlicuotaIVAViewSet, basename='alicuotaiva')

# ===== FUNCIONES PARA MANEJAR REACT SPA =====

def serve_react_app(request):
    """Sirve la aplicación React para todas las rutas del frontend"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        index_path = os.path.join(settings.REACT_APP_DIR, 'index.html')
        logger.info(f"Serving React app for path: {request.path}, index_path: {index_path}")
        
        # Si el usuario NO está autenticado y está intentando acceder al home, redirigir a la landing
        if not request.user.is_authenticated and request.path.startswith('/home'):
            logger.info("Usuario no autenticado intentando acceder a /home, agregando meta redirect")
            with open(index_path, 'rb') as f:
                content = f.read()
                # Insertar el meta tag de redirección después del <head>
                content = content.replace(b'<head>', b'<head><meta name="x-redirect" content="/">')
                from django.http import HttpResponse
                return HttpResponse(content, content_type='text/html')
        
        # Para todas las demás rutas, servir el index.html de React
        logger.info(f"Serving index.html from: {index_path}")
        if not os.path.exists(index_path):
            logger.error(f"index.html no encontrado en: {index_path}")
            raise Http404("Archivo index.html no encontrado")
            
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
            
    except Exception as e:
        logger.error(f"Error en serve_react_app: {str(e)}")
        raise Http404(f"Error al servir la aplicación React: {str(e)}")

def serve_static_file(request, filename):
    """Vista para servir archivos estáticos del frontend"""
    # Solo manejar archivos que tienen extensión (evitar conflictos con rutas del SPA)
    if '.' not in filename:
        raise Http404("No es un archivo estático")
        
    file_path = os.path.join(settings.REACT_APP_DIR, filename)
    if os.path.exists(file_path):
        with open(file_path, 'rb') as f:
            content = f.read()
        # Determinar el tipo de contenido basado en la extensión
        content_type = 'text/plain'
        if filename.endswith('.json'):
            content_type = 'application/json'
        elif filename.endswith('.ico'):
            content_type = 'image/x-icon'
        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
            content_type = 'image/jpeg'
        elif filename.endswith('.png'):
            content_type = 'image/png'
        elif filename.endswith('.css'):
            content_type = 'text/css'
        elif filename.endswith('.js'):
            content_type = 'application/javascript'
        
        return FileResponse(content, content_type=content_type)
    else:
        raise Http404("Archivo no encontrado")

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
    path('api/ferreteria/', FerreteriaAPIView.as_view(), name='ferreteria-api'),
    
    # ===== AUTENTICACIÓN =====
    path('api/', include('ferreapps.login.urls')),  # Solo APIs de autenticación
]

# ===== ARCHIVOS ESTÁTICOS Y MEDIA =====
if settings.STATIC_URL and settings.STATIC_ROOT:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
if settings.MEDIA_URL and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# En modo DEBUG, también servir archivos estáticos desde STATICFILES_DIRS
if settings.DEBUG:
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Serving static files in DEBUG mode from: {settings.STATICFILES_DIRS}")
    
    # Agregar rutas para archivos estáticos en modo DEBUG
    for static_dir in settings.STATICFILES_DIRS:
        if os.path.exists(static_dir):
            urlpatterns += static(settings.STATIC_URL, document_root=static_dir)

# ===== REACT SPA CATCH-ALL =====
# IMPORTANTE: Estos deben ir AL FINAL para capturar rutas no manejadas
urlpatterns += [
    # Archivos específicos del frontend (solo archivos con extensión)
    re_path(r'^(?P<filename>[^/]+\.\w+)$', serve_static_file, name='static_file'),
    # CATCH-ALL: Todas las demás rutas van a React Router
    re_path(r'^.*$', serve_react_app, name='react_spa'),
]
