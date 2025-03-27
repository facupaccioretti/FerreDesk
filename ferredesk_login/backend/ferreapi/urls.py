from django.urls import path
from ferreapi.views import login_view

urlpatterns = [
    path('api/login/', login_view),
]