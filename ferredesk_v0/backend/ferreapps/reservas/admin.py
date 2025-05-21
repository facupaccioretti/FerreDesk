from django.contrib import admin
from .models import ReservaStock

@admin.register(ReservaStock)
class ReservaStockAdmin(admin.ModelAdmin):
    list_display = ('producto', 'proveedor', 'cantidad', 'usuario', 'estado', 'timestamp_creacion')
    search_fields = ('producto__deno', 'proveedor__razon', 'usuario__username')
    list_filter = ('estado', 'producto', 'proveedor', 'usuario')
