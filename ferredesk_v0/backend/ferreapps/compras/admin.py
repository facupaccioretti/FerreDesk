from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Compra, CompraDetalleItem, OrdenCompra, OrdenCompraDetalleItem


class CompraDetalleItemInline(admin.TabularInline):
    """Inline para mostrar los items de una compra"""
    model = CompraDetalleItem
    extra = 0
    readonly_fields = ['cdi_orden']
    fields = ['cdi_orden', 'cdi_idsto', 'cdi_detalle1', 'cdi_detalle2', 'cdi_cantidad', 'cdi_idaliiva']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('cdi_idsto', 'cdi_idaliiva')


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    """Admin para el modelo Compra"""
    list_display = [
        'comp_id', 
        'comp_numero_factura', 
        'comp_fecha', 
        'comp_razon_social', 
        'comp_tipo', 
        'comp_estado', 
        'comp_total_final',
        'verificacion_totales'
    ]
    
    list_filter = [
        'comp_tipo',
        'comp_estado', 
        'comp_fecha',
        'comp_sucursal'
    ]
    
    search_fields = [
        'comp_numero_factura',
        'comp_razon_social',
        'comp_cuit',
        'comp_observacion'
    ]
    
    readonly_fields = [
        'comp_id',
        'comp_hora_creacion',
        'comp_verificacion_total',
        'comp_fecha_anulacion',
        'verificacion_totales'
    ]
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'comp_id', 'comp_sucursal', 'comp_fecha', 'comp_hora_creacion',
                'comp_tipo', 'comp_estado'
            )
        }),
        ('Datos de Factura', {
            'fields': (
                'comp_numero_factura', 'comp_numero_factura_proveedor',
                'comp_fecha_factura_proveedor'
            )
        }),
        ('Proveedor', {
            'fields': (
                'comp_idpro', 'comp_cuit', 'comp_razon_social', 'comp_domicilio'
            )
        }),
        ('Importes', {
            'fields': (
                'comp_total_final', 'comp_importe_neto',
                'comp_iva_21', 'comp_iva_10_5', 'comp_iva_27', 'comp_iva_0',
                'comp_verificacion_total', 'verificacion_totales'
            )
        }),
        ('Otros', {
            'fields': ('comp_observacion', 'comp_fecha_anulacion'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [CompraDetalleItemInline]
    
    actions = ['cerrar_compras']
    
    def verificacion_totales(self, obj):
        """Muestra si los totales coinciden"""
        if obj.verificar_totales():
            return format_html(
                '<span style="color: green;">✓ Correcto</span>'
            )
        else:
            return format_html(
                '<span style="color: red;">✗ Incorrecto</span>'
            )
    verificacion_totales.short_description = 'Verificación Totales'
    
    def cerrar_compras(self, request, queryset):
        """Acción para cerrar compras seleccionadas"""
        count = 0
        for compra in queryset.filter(comp_estado='BORRADOR'):
            try:
                compra.cerrar_compra()
                count += 1
            except ValueError as e:
                self.message_user(request, f"Error al cerrar compra {compra.comp_id}: {e}", level='ERROR')
        
        self.message_user(request, f"Se cerraron {count} compras exitosamente")
    cerrar_compras.short_description = "Cerrar compras seleccionadas"
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('comp_idpro')


@admin.register(CompraDetalleItem)
class CompraDetalleItemAdmin(admin.ModelAdmin):
    """Admin para el modelo CompraDetalleItem"""
    list_display = [
        'cdi_idca', 
        'cdi_orden', 
        'cdi_detalle1', 
        'cdi_cantidad', 
        'cdi_detalle2',
        'cdi_idpro'
    ]
    
    list_filter = ['cdi_idpro', 'cdi_idaliiva']
    
    search_fields = ['cdi_detalle1', 'cdi_detalle2']
    
    readonly_fields = ['cdi_idca']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('cdi_idca', 'cdi_idpro', 'cdi_idsto', 'cdi_idaliiva')


# ============================================================================
# ADMIN PARA ÓRDENES DE COMPRA
# ============================================================================

class OrdenCompraDetalleItemInline(admin.TabularInline):
    """Inline para items de orden de compra"""
    model = OrdenCompraDetalleItem
    extra = 1
    fields = ['odi_orden', 'odi_idsto', 'odi_stock_proveedor', 'odi_cantidad', 'odi_detalle1', 'odi_detalle2']
    readonly_fields = ['odi_orden']


@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    """Admin para el modelo OrdenCompra"""
    list_display = [
        'ord_id', 
        'ord_numero', 
        'ord_fecha', 
        'ord_razon_social', 
        'cantidad_items'
    ]
    
    list_filter = ['ord_sucursal', 'ord_fecha']
    
    search_fields = ['ord_numero', 'ord_razon_social', 'ord_cuit', 'ord_observacion']
    
    readonly_fields = ['ord_id', 'ord_hora_creacion']
    
    date_hierarchy = 'ord_fecha'
    
    fieldsets = (
        ('Información Básica', {
            'fields': (
                'ord_id', 'ord_sucursal', 'ord_fecha', 'ord_hora_creacion',
                'ord_numero'
            )
        }),
        ('Proveedor', {
            'fields': (
                'ord_idpro', 'ord_cuit', 'ord_razon_social', 'ord_domicilio'
            )
        }),
        ('Otros', {
            'fields': ('ord_observacion',),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [OrdenCompraDetalleItemInline]
    
    def cantidad_items(self, obj):
        """Muestra la cantidad de items en la orden"""
        return obj.items.count()
    cantidad_items.short_description = 'Items'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ord_idpro')


@admin.register(OrdenCompraDetalleItem)
class OrdenCompraDetalleItemAdmin(admin.ModelAdmin):
    """Admin para el modelo OrdenCompraDetalleItem"""
    list_display = [
        'odi_idor', 
        'odi_orden', 
        'odi_detalle1', 
        'odi_cantidad', 
        'odi_detalle2',
        'odi_idpro'
    ]
    
    list_filter = ['odi_idpro']
    
    search_fields = ['odi_detalle1', 'odi_detalle2']
    
    readonly_fields = ['odi_idor']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('odi_idor', 'odi_idpro', 'odi_idsto')



