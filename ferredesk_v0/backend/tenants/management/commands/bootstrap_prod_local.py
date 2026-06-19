from django.core.management.base import BaseCommand
from django_tenants.utils import get_public_schema_name, schema_context
import os

from tenants.models import EmpresaTenant
from tenants.models import TokenVerificacionEmail
from tenants.services.provisioning_onboarding_service import provisionar_tenant_completo
from tenants.services.servicio_constructor_tenant import _construir_dominio_primario
from tenants.services.verificacion_email_service import activar_tenant_por_token


def _env(name, default):
    value = os.environ.get(name)
    if value in (None, ""):
        return default
    return value


class Command(BaseCommand):
    help = "Crea o completa un tenant demo local para el entorno prod-local."

    def handle(self, *args, **options):
        nombre = _env("BOOTSTRAP_TENANT_NAME", "FerreDesk Local")
        slug = _env("BOOTSTRAP_TENANT_SLUG", "ferrelocal")
        email = _env("BOOTSTRAP_ADMIN_EMAIL", "admin@ferrelocal.lvh.me")
        password = _env("BOOTSTRAP_ADMIN_PASSWORD", "admin123local")
        auto_activate = str(_env("BOOTSTRAP_AUTO_ACTIVATE", "true")).lower() == "true"

        with schema_context(get_public_schema_name()):
            tenant = EmpresaTenant.objects.filter(schema_name=slug).first()

            if tenant is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"Tenant local '{slug}' inexistente. Creando tenant y cuenta publica demo."
                    )
                )
                resultado = provisionar_tenant_completo(
                    nombre=nombre,
                    slug=slug,
                    email=email,
                    password=password,
                )
                tenant = resultado["tenant"]
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"Tenant local '{slug}' ya existe. Verificando estado de activacion."
                    )
                )

            if auto_activate and tenant.estado_suscripcion != EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO:
                token = "bootstrap-prod-local-token"
                TokenVerificacionEmail.objects.update_or_create(
                    email=tenant.email_admin,
                    defaults={
                        "token": token,
                        "tenant": tenant,
                    },
                )
                tenant = activar_tenant_por_token(email=tenant.email_admin, token=token)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Tenant '{slug}' activado localmente para permitir login inmediato."
                    )
                )

            dominio = tenant.get_primary_domain()
            if dominio is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"El tenant '{slug}' no tiene dominio primario. Esperado: {_construir_dominio_primario(slug)}."
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Bootstrap prod-local listo: tenant={tenant.schema_name} dominio={dominio.domain} admin={email}"
                    )
                )
