from django.contrib import admin

from acceso_publico.models import CuentaAccesoPublico, TokenPuenteAcceso


@admin.register(CuentaAccesoPublico)
class CuentaAccesoPublicoAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "nombre_mostrar",
        "username_tenant",
        "tenant_asignado",
        "activo",
        "fecha_creacion",
        "ultimo_acceso",
    )
    list_filter = ("activo", "fecha_creacion")
    search_fields = (
        "email",
        "nombre_mostrar",
        "username_tenant",
        "email_tenant",
        "tenant_asignado__nombre",
        "tenant_asignado__slug_subdominio",
    )
    ordering = ("-fecha_creacion",)


@admin.register(TokenPuenteAcceso)
class TokenPuenteAccesoAdmin(admin.ModelAdmin):
    list_display = ("tenant_asignado", "username_tenant", "usado", "expira_en", "fecha_creacion", "usado_en")
    list_filter = ("usado", "fecha_creacion", "expira_en")
    search_fields = ("token", "username_tenant", "tenant_asignado__schema_name", "cuenta__email")
    ordering = ("-fecha_creacion",)
