from django.apps import AppConfig


class ComprasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ferreapps.compras'
    verbose_name = 'Sistema de Compras'
    
    def ready(self):
        """Método que se ejecuta cuando la app está lista"""
        try:
            import ferreapps.compras.signals  # noqa
        except ImportError:
            pass
