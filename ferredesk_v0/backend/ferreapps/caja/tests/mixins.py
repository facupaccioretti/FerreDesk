"""
Mixin y fixtures compartidos para tests del módulo de Caja.

Este módulo contiene utilidades reutilizables para crear datos de prueba.
"""

from decimal import Decimal
import re
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import BaseTenantRequestFactory

from tenants.models import EmpresaTenant
from ..models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    ESTADO_CAJA_ABIERTA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
)

Usuario = get_user_model()


class TenantAPIClient(BaseTenantRequestFactory, APIClient):
    """APIClient con dominio y tenant resueltos por django-tenants."""


class CajaTenantTestCase(TenantTestCase):
    """Base tenant-aware para tests del dominio ferreapps."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.setUpTestData()

    @classmethod
    def _test_slug(cls):
        slug = re.sub(r'[^a-z0-9]+', '', cls.__name__.lower())
        return (slug or 'cajatest')[:20]

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = f"Tenant {cls.__name__}"
        tenant.slug_subdominio = cls._test_slug()
        tenant.email_admin = f"{cls._test_slug()}@test.com"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return f"t_{cls._test_slug()}"[:30]

    @classmethod
    def get_test_tenant_domain(cls):
        host_label = cls.get_test_schema_name().replace('_', '-')
        return f"{host_label}.localhost"

    def setUp(self):
        super().setUp()
        connection.set_tenant(self.tenant)
        self.tenant_domain = self.get_test_tenant_domain()


class CajaTenantAPITestCase(CajaTenantTestCase):
    """Base tenant-aware con APIClient configurado al dominio del tenant."""

    def setUp(self):
        super().setUp()
        self.client = TenantAPIClient(self.tenant)


class CajaTestMixin:
    """Mixin con métodos helper para crear datos de prueba."""
    
    @classmethod
    def crear_usuario_test(cls, username='testuser', password='testpass123'):
        """Crea un usuario de prueba."""
        return Usuario.objects.create_user(
            username=username,
            password=password,
            email=f'{username}@test.com'
        )
    
    @classmethod
    def obtener_metodo_efectivo(cls):
        """Obtiene el método de pago 'efectivo' creado por la data migration."""
        return MetodoPago.objects.get(codigo=CODIGO_EFECTIVO)
    
    def crear_sesion_caja(self, usuario, saldo_inicial=Decimal('1000.00'), estado=ESTADO_CAJA_ABIERTA, sucursal=1):
        """Crea una sesión de caja de prueba."""
        return SesionCaja.objects.create(
            usuario=usuario,
            sucursal=sucursal,
            saldo_inicial=saldo_inicial,
            estado=estado,
        )
    
    def crear_movimiento(self, sesion, usuario, tipo, monto, descripcion='Test'):
        """Crea un movimiento de caja de prueba."""
        return MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=usuario,
            tipo=tipo,
            monto=monto,
            descripcion=descripcion,
        )
