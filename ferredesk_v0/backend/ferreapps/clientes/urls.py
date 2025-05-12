from rest_framework import routers
from .views import (
    LocalidadViewSet, ProvinciaViewSet, BarrioViewSet, TipoIVAViewSet, TransporteViewSet,
    VendedorViewSet, PlazoViewSet, CategoriaClienteViewSet, ClienteViewSet
)

router = routers.DefaultRouter()
router.register(r'localidades', LocalidadViewSet)
router.register(r'provincias', ProvinciaViewSet)
router.register(r'barrios', BarrioViewSet)
router.register(r'tiposiva', TipoIVAViewSet)
router.register(r'transportes', TransporteViewSet)
router.register(r'vendedores', VendedorViewSet)
router.register(r'plazos', PlazoViewSet)
router.register(r'categorias', CategoriaClienteViewSet)
router.register(r'clientes', ClienteViewSet)

urlpatterns = router.urls 