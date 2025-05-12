from django.urls import path, re_path
from . import views

urlpatterns = [
    path('api/login/', views.login_view, name='login'),
    path('api/logout/', views.logout_view, name='logout'),
    path('api/user/', views.user_view, name='user'),
    # Capturar todas las demás rutas y enviarlas a la vista index
    # Esta ruta debe ir al final para no interferir con las rutas de la API
    re_path(r'^(?!api/).*$', views.index, name='index'),
]