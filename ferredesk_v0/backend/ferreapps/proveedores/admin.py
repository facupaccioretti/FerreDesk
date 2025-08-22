from django.contrib import admin
from .models import HistorialImportacionProveedor


@admin.register(HistorialImportacionProveedor)
class HistorialImportacionProveedorAdmin(admin.ModelAdmin):
    list_display = ("proveedor", "fecha", "nombre_archivo", "registros_procesados", "registros_actualizados")
    list_filter = ("proveedor", "fecha")
    search_fields = ("nombre_archivo", "proveedor__razon")
from .models import Proveedor

# Register your models here.
admin.site.register(Proveedor)
