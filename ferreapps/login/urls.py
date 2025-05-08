from django.urls import path, re_path
from . import views

urlpatterns = [
    path('api/login/', views.login_view, name='login'),
    # Capturar todas las demás rutas EXCEPTO admin y enviarlas a la vista index
    re_path(r'^(?!admin/).*$', views.index, name='index'),
] 