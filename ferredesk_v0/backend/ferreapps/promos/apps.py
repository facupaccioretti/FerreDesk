from django.apps import AppConfig


class PromosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ferreapps.promos'

    def ready(self):
        from ferreapps.promos import signals  # noqa: F401
