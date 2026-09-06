from django.contrib import admin
from django.core.exceptions import PermissionDenied
from .models import Imputacion


@admin.register(Imputacion)
class ImputacionAdmin(admin.ModelAdmin):
    """
    Admin para el modelo unificado Imputacion
    """
    list_display = [
        'imp_id', 'imp_fecha', 'imp_monto', 
        'origen_display', 'flecha', 'destino_display'
    ]
    list_filter = [
        'imp_fecha', 'origen_content_type', 'destino_content_type'
    ]
    search_fields = [
        'imp_id', 'imp_observacion', 'origen_id', 'destino_id'
    ]
    readonly_fields = ['imp_id']
    date_hierarchy = 'imp_fecha'
    
    fieldsets = (
        ('Información General', {
            'fields': ('imp_id', 'imp_fecha', 'imp_monto', 'imp_observacion')
        }),
        ('Origen (El Pago)', {
            'fields': ('origen_content_type', 'origen_id')
        }),
        ('Destino (La Deuda)', {
            'fields': ('destino_content_type', 'destino_id')
        }),
    )
    
    def origen_display(self, obj):
        return f"{obj.origen_content_type.model.title()}: {obj.origen}"
    origen_display.short_description = 'Origen'

    def destino_display(self, obj):
        return f"{obj.destino_content_type.model.title()}: {obj.destino}"
    destino_display.short_description = 'Destino'

    def flecha(self, obj):
        return "→"
    flecha.short_description = ""

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'origen_content_type', 'destino_content_type'
        )

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.es_postventa:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.es_postventa:
            return False
        return super().has_delete_permission(request, obj)

    def delete_queryset(self, request, queryset):
        if queryset.filter(imp_idempotency_key__startswith='postventa').exists():
            raise PermissionDenied('Las imputaciones de postventa no se pueden eliminar.')
        super().delete_queryset(request, queryset)
