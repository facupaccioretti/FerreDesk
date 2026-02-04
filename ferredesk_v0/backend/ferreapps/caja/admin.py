"""Configuración del admin de Django para el módulo de Caja.

Permite administrar sesiones de caja, movimientos y métodos de pago
desde el panel de administración de Django.
"""

from django.contrib import admin
from .models import SesionCaja, MovimientoCaja, MetodoPago, PagoVenta


@admin.register(SesionCaja)
class SesionCajaAdmin(admin.ModelAdmin):
    """Administración de sesiones de caja."""
    
    list_display = [
        'id', 
        'usuario', 
        'sucursal', 
        'estado', 
        'fecha_hora_inicio', 
        'fecha_hora_fin',
        'saldo_inicial',
        'saldo_final_declarado',
        'diferencia',
    ]
    list_filter = ['estado', 'sucursal', 'fecha_hora_inicio']
    search_fields = ['usuario__username', 'id']
    ordering = ['-fecha_hora_inicio']
    readonly_fields = ['fecha_hora_inicio', 'saldo_final_sistema', 'diferencia']
    
    fieldsets = (
        ('Información General', {
            'fields': ('usuario', 'sucursal', 'estado')
        }),
        ('Timestamps', {
            'fields': ('fecha_hora_inicio', 'fecha_hora_fin')
        }),
        ('Saldos', {
            'fields': ('saldo_inicial', 'saldo_final_declarado', 'saldo_final_sistema', 'diferencia')
        }),
        ('Observaciones', {
            'fields': ('observaciones_cierre',),
            'classes': ('collapse',)
        }),
    )


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    """Administración de movimientos de caja."""
    
    list_display = ['id', 'sesion_caja', 'tipo', 'monto', 'descripcion', 'fecha_hora', 'usuario']
    list_filter = ['tipo', 'fecha_hora', 'sesion_caja__estado']
    search_fields = ['descripcion', 'usuario__username']
    ordering = ['-fecha_hora']
    readonly_fields = ['fecha_hora']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('sesion_caja', 'usuario')


@admin.register(MetodoPago)
class MetodoPagoAdmin(admin.ModelAdmin):
    """Administración de métodos de pago."""
    
    list_display = ['id', 'codigo', 'nombre', 'afecta_arqueo', 'activo', 'orden']
    list_filter = ['afecta_arqueo', 'activo']
    search_fields = ['codigo', 'nombre']
    ordering = ['orden', 'nombre']
    list_editable = ['orden', 'activo']


@admin.register(PagoVenta)
class PagoVentaAdmin(admin.ModelAdmin):
    """Administración de pagos de ventas."""
    
    list_display = ['id', 'venta', 'metodo_pago', 'monto', 'es_vuelto', 'fecha_hora']
    list_filter = ['metodo_pago', 'es_vuelto', 'fecha_hora']
    search_fields = ['venta__ven_id', 'referencia_externa']
    ordering = ['-fecha_hora']
    readonly_fields = ['fecha_hora']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('venta', 'metodo_pago')
