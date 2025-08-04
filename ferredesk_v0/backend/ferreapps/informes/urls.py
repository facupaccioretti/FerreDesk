from django.urls import path
from . import views

app_name = 'informes'

urlpatterns = [
    path('stock-bajo/', views.StockBajoView.as_view(), name='stock-bajo'),
    path('stock-bajo/pdf/', views.StockBajoPDFView.as_view(), name='stock-bajo-pdf'),
] 