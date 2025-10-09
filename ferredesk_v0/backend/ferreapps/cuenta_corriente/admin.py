from django.contrib import admin
from .models import ImputacionVenta


@admin.register(ImputacionVenta)
class ImputacionVentaAdmin(admin.ModelAdmin):
    """
    Admin para el modelo ImputacionVenta
    """
    list_display = [
        'imp_id', 'imp_fecha', 'imp_monto', 'factura_numero', 
        'recibo_numero', 'cliente_nombre'
    ]
    list_filter = [
        'imp_fecha', 'imp_id_venta__comprobante__tipo'
    ]
    search_fields = [
        'imp_id_venta__numero_formateado', 'imp_id_recibo__numero_formateado',
        'imp_id_venta__ven_razon_social'
    ]
    readonly_fields = ['imp_id']
    date_hierarchy = 'imp_fecha'
    
    fieldsets = (
        ('Información General', {
            'fields': ('imp_id', 'imp_fecha', 'imp_monto', 'imp_observacion')
        }),
        ('Relaciones', {
            'fields': ('imp_id_venta', 'imp_id_recibo')
        }),
    )
    
    def factura_numero(self, obj):
        """Mostrar número formateado de la factura"""
        return obj.imp_id_venta.numero_formateado if obj.imp_id_venta else '-'
    factura_numero.short_description = 'Factura'
    
    def recibo_numero(self, obj):
        """Mostrar número formateado del recibo"""
        return obj.imp_id_recibo.numero_formateado if obj.imp_id_recibo else '-'
    recibo_numero.short_description = 'Recibo'
    
    def cliente_nombre(self, obj):
        """Mostrar nombre del cliente"""
        return obj.imp_id_venta.ven_razon_social if obj.imp_id_venta else '-'
    cliente_nombre.short_description = 'Cliente'
    
    def get_queryset(self, request):
        """Optimizar consultas con select_related"""
        return super().get_queryset(request).select_related(
            'imp_id_venta', 'imp_id_recibo'
        )
