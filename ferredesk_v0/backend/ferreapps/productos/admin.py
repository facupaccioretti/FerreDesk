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
    list_display = ('codigo', 'nombre', 'categoria', 'precio_venta', 'stock', 'ferreteria', 'activo')
    list_filter = ('categoria', 'ferreteria', 'activo')
    search_fields = ('codigo', 'nombre', 'descripcion')
    list_editable = ('precio_venta', 'stock', 'activo')
    readonly_fields = ('fecha_creacion', 'fecha_actualizacion')
