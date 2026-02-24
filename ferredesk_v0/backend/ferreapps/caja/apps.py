from django.apps import AppConfig


class CajaConfig(AppConfig):
    """Configuración de la app Caja y Tesorería.
    
    Esta app maneja:
    - Sesiones de caja (apertura, cierre X/Z)
    - Movimientos de caja (ingresos/egresos manuales)
    - Catálogo de métodos de pago
    - Detalle de pagos por venta (pagos mixtos)
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ferreapps.caja'
    verbose_name = 'Caja y Tesorería'
