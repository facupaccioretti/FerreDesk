from django.db import connection
from django.http import JsonResponse
from django_tenants.utils import get_public_schema_name, schema_context

from tenants.models import EmpresaTenant


class HealthCheckBypassMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/api/health/":
            return JsonResponse({"status": "ok"})
        return self.get_response(request)


class SuscripcionMiddleware:
    RUTAS_EXENTAS = {
        "/api/health/",
        "/api/login/",
        "/api/registro/",
        "/api/auth/password-reset/",
        "/api/auth/password-reset/confirm/",
    }
    ESTADOS_BLOQUEADOS = {
        EmpresaTenant.ESTADO_SUSCRIPCION_PENDIENTE_VERIFICACION,
        EmpresaTenant.ESTADO_SUSCRIPCION_SUSPENDIDO,
        EmpresaTenant.ESTADO_SUSCRIPCION_CANCELADO,
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        schema_name = getattr(connection, "schema_name", get_public_schema_name())
        if schema_name == get_public_schema_name() or request.path in self.RUTAS_EXENTAS:
            return self.get_response(request)

        tenant = getattr(request, "tenant", None)
        if tenant is None or getattr(tenant, "schema_name", None) != schema_name:
            with schema_context(get_public_schema_name()):
                tenant = EmpresaTenant.objects.filter(schema_name=schema_name).first()

        if tenant and tenant.estado_suscripcion in self.ESTADOS_BLOQUEADOS:
            return JsonResponse(
                {"error": "Suscripcion inactiva. Contacta soporte."},
                status=403,
            )

        return self.get_response(request)
