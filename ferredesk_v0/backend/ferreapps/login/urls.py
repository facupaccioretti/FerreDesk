from django.urls import path, re_path
from . import views

urlpatterns = [
    path('api/login/', views.login_view, name='login'),
    path('api/logout/', views.logout_view, name='logout'),
    path('api/user/', views.user_view, name='user'),
    # Capturar solo las rutas del frontend (páginas principales)
    # No capturar rutas estáticas, media, admin, etc.
    path('', views.index, name='index'),  # Solo la ruta raíz
    path('dashboard/', views.index, name='dashboard'),
    path('dashboards/', views.index, name='dashboards'),
    path('productos/', views.index, name='productos'),
    path('clientes/', views.index, name='clientes'),
    path('ventas/', views.index, name='ventas'),
    path('login/', views.index, name='login_page'),
    path('register/', views.index, name='register'),
]