from django.urls import path
from .views import ProveedorListCreateView, ProveedorRetrieveUpdateDestroyView

urlpatterns = [
    path('', ProveedorListCreateView.as_view(), name='proveedor-list-create'),
    path('<int:pk>/', ProveedorRetrieveUpdateDestroyView.as_view(), name='proveedor-detail'),
] 