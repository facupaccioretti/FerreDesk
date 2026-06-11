from django.contrib import admin

from tenants.models import Dominio, EmpresaTenant


@admin.register(EmpresaTenant)
class EmpresaTenantAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "slug_subdominio",
        "estado_suscripcion",
        "activo",
        "fecha_creacion",
    )
    search_fields = ("nombre", "slug_subdominio", "email_admin")
    list_filter = ("estado_suscripcion", "activo", "fecha_creacion")


@admin.register(Dominio)
class DominioAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    search_fields = ("domain", "tenant__nombre", "tenant__slug_subdominio")
    list_filter = ("is_primary",)
