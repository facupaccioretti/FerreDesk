import re
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import BaseTenantRequestFactory
from rest_framework.test import APIClient

from tenants.models import EmpresaTenant


class TenantAPIClient(BaseTenantRequestFactory, APIClient):
    """APIClient con dominio y tenant resueltos por django-tenants."""


class ProductoTenantTestCase(TenantTestCase):
    """Base tenant-aware para tests del dominio productos."""

    @classmethod
    def _test_slug(cls):
        slug = re.sub(r"[^a-z0-9]+", "", cls.__name__.lower())
        return (slug or "productostest")[:20]

    @classmethod
    def setup_tenant(cls, tenant):
        slug = cls._test_slug()
        tenant.nombre = f"Tenant {cls.__name__}"
        tenant.slug_subdominio = slug
        tenant.email_admin = f"{slug}@test.com"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return f"t_{cls._test_slug()}"[:30]

    @classmethod
    def get_test_tenant_domain(cls):
        host_label = cls.get_test_schema_name().replace("_", "-")
        return f"{host_label}.localhost"

class ProductoTenantAPITestCase(ProductoTenantTestCase):
    """Base tenant-aware con APIClient configurado al dominio del tenant."""

    def setUp(self):
        super().setUp()
        self.client = TenantAPIClient(self.tenant)
