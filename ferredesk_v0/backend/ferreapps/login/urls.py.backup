from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
    path('api/login/', views.login_view, name='login'),
    path('api/logout/', views.logout_view, name='logout'),
    path('api/user/', views.user_view, name='user'),
    # Capturar solo las rutas del frontend (páginas principales)
    # No capturar rutas estáticas, media, admin, etc.
    path('', views.index, name='index'),  # Solo la ruta raíz
    path('home/', views.index, name='home'),  # Ruta home
    path('dashboard/', views.index, name='dashboard'),
    path('dashboards/', views.index, name='dashboards'),
    path('productos/', views.index, name='productos'),
    path('clientes/', views.index, name='clientes'),
    path('ventas/', views.index, name='ventas'),
    path('login/', views.index, name='login_page'),
    path('login', views.index, name='login_page_no_slash'),  # Sin barra para compatibilidad
    path('register/', views.index, name='register'),
    # Servir archivos estáticos del frontend
    path('<str:filename>', views.serve_static_file, name='static_file'),
]

# Agregar URLs para archivos estáticos del frontend
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)