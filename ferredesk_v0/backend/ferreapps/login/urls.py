from django.urls import path
from . import views

# ===== URLs DE AUTENTICACIÓN =====
# Este módulo ahora solo maneja autenticación
# Las rutas del SPA se manejan en ferredesk_backend/urls.py

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('user/', views.user_view, name='user'),
]