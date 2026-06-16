"""
URL configuration for ferredesk_backend project.

Tenant URLConf: this module serves ERP routes for tenant schemas only.
Public platform routes live in ferredesk_backend.urls_public.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter

from ferreapps.productos.views import (
    AlicuotaIVAViewSet,
    EstadoSetupAPIView,
    FamiliaViewSet,
    FerreteriaAPIView,
    ProveedorViewSet,
    StockProveViewSet,
    StockViewSet,
)
from ferredesk_backend.views import serve_react_root_file

router = DefaultRouter()
router.register(r"productos/stock", StockViewSet, basename="stock")
router.register(r"productos/proveedores", ProveedorViewSet, basename="proveedor")
router.register(r"productos/stockprove", StockProveViewSet, basename="stockprove")
router.register(r"productos/familias", FamiliaViewSet, basename="familia")
router.register(r"productos/alicuotasiva", AlicuotaIVAViewSet, basename="alicuotaiva")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/usuarios/", include("ferreapps.usuarios.urls")),
    path("api/clientes/", include("ferreapps.clientes.urls")),
    path("api/productos/", include("ferreapps.productos.urls")),
    path("api/proveedores/", include("ferreapps.proveedores.urls")),
    path("api/", include("ferreapps.ventas.urls")),
    path("api/", include("ferreapps.alertas.urls")),
    path("api/", include("ferreapps.notas.urls")),
    path("api/", include("ferreapps.compras.urls")),
    path("api/informes/", include("ferreapps.informes.urls")),
    path("api/cuenta-corriente/", include("ferreapps.cuenta_corriente.urls")),
    path("api/caja/", include("ferreapps.caja.urls")),
    path("api/sistema/", include("ferreapps.sistema.urls")),
    path("api/ferreteria/", FerreteriaAPIView.as_view(), name="ferreteria-api"),
    path("api/ferreteria/estado-setup/", EstadoSetupAPIView.as_view(), name="ferreteria-estado-setup"),
    path("api/", include("ferreapps.login.urls")),
]

if settings.MEDIA_URL and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    path("favicon.ico", lambda r: serve_react_root_file(r, "favicon.ico"), name="favicon"),
    path("manifest.json", lambda r: serve_react_root_file(r, "manifest.json"), name="manifest"),
    path("robots.txt", lambda r: serve_react_root_file(r, "robots.txt"), name="robots"),
    path("logo-arca.jpg", lambda r: serve_react_root_file(r, "logo-arca.jpg"), name="logo"),
]

urlpatterns += [
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html"), name="react_spa"),
]
