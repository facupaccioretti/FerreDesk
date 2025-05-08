from django.urls import path, re_path
from . import views

urlpatterns = [
    path('api/login/', views.login_view, name='login'),
    # Capturar todas las demás rutas y enviarlas a la vista index
    re_path(r'^.*$', views.index, name='index'),
]