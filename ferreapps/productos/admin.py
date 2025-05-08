from django.contrib import admin
from .models import Ferreteria, Categoria, Producto

@admin.register(Ferreteria)
class FerreteriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'direccion', 'telefono', 'email', 'activa')
    list_filter = ('activa',)
    search_fields = ('nombre', 'direccion', 'email')

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion')
    search_fields = ('nombre',)

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'categoria', 'precio', 'stock', 'ferreteria')
    list_filter = ('categoria', 'ferreteria')
    search_fields = ('codigo', 'nombre', 'descripcion')
    list_per_page = 20 