from django.contrib import admin

from tenants.models import Dominio, EmpresaTenant, SolicitudOnboardingTenant, TokenVerificacionEmail


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


@admin.register(TokenVerificacionEmail)
class TokenVerificacionEmailAdmin(admin.ModelAdmin):
    list_display = ("email", "tenant", "creado_en")
    search_fields = ("email", "tenant__nombre", "tenant__slug_subdominio")


@admin.register(SolicitudOnboardingTenant)
class SolicitudOnboardingTenantAdmin(admin.ModelAdmin):
    list_display = ("id", "slug", "email_admin", "estado", "error_codigo", "tenant", "intentos", "creado_en")
    search_fields = ("slug", "email_admin", "nombre", "error_codigo", "tenant__schema_name")
    list_filter = ("estado", "creado_en", "actualizado_en")
    readonly_fields = ("payload_resumen", "creado_en", "actualizado_en")
