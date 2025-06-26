from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LocalidadViewSet, ProvinciaViewSet, BarrioViewSet, TipoIVAViewSet, TransporteViewSet,
    VendedorViewSet, PlazoViewSet, CategoriaClienteViewSet, ClienteViewSet,
    BarrioList, LocalidadList, ProvinciaList, TipoIVAList, TransporteList, VendedorList, PlazoList, CategoriaClienteList
)

router = DefaultRouter()
router.register(r'localidades', LocalidadViewSet)
router.register(r'provincias', ProvinciaViewSet)
router.register(r'barrios', BarrioViewSet)
router.register(r'tiposiva', TipoIVAViewSet)
router.register(r'transportes', TransporteViewSet)
router.register(r'vendedores', VendedorViewSet)
router.register(r'plazos', PlazoViewSet)
router.register(r'categorias', CategoriaClienteViewSet)
router.register(r'clientes', ClienteViewSet, basename='cliente')

urlpatterns = router.urls 