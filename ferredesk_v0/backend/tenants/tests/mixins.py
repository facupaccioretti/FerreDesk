from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.core.management import call_command
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django_tenants.utils import get_public_schema_name, get_tenant_domain_model, schema_context

from tenants.models import EmpresaTenant


class TenantTransactionTestCase(TransactionTestCase):
    tenant_schema_name = "testtransaction"
    tenant_domain = "testtransaction.lvh.me"
    tenant_email = "admin@transaction.test"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command(
            "migrate_schemas",
            schema_name=get_public_schema_name(),
            interactive=False,
            verbosity=0,
        )
        cls.tenant = EmpresaTenant(
            schema_name=cls.tenant_schema_name,
            nombre=f"Tenant {cls.__name__}",
            slug_subdominio=cls.tenant_schema_name,
            email_admin=cls.tenant_email,
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        cls.tenant.save(verbosity=0)
        cls.domain = get_tenant_domain_model()(
            tenant=cls.tenant,
            domain=cls.tenant_domain,
        )
        cls.domain.save()
        connection.set_tenant(cls.tenant)

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        cls.domain.delete()
        cls.tenant.delete(force_drop=True)
        super().tearDownClass()

    def setUp(self):
        connection.set_tenant(self.tenant)

    @staticmethod
    def _run_in_schema(schema_name, barrier, operation):
        close_old_connections()
        try:
            with schema_context(schema_name):
                barrier.wait(timeout=10)
                return operation()
        except Exception as exc:
            return exc
        finally:
            close_old_connections()

    def run_concurrently(self, *operations):
        barrier = Barrier(len(operations))
        with ThreadPoolExecutor(max_workers=len(operations)) as executor:
            futures = [
                executor.submit(
                    self._run_in_schema,
                    self.tenant.schema_name,
                    barrier,
                    operation,
                )
                for operation in operations
            ]
            return [future.result(timeout=30) for future in futures]


class TwoTenantIsolationTestCase(TransactionTestCase):
    tenant_a_schema_name = "testisolationa"
    tenant_b_schema_name = "testisolationb"
    tenant_a_domain = "testisolationa.lvh.me"
    tenant_b_domain = "testisolationb.lvh.me"
    tenant_a_email = "admin@isolationa.test"
    tenant_b_email = "admin@isolationb.test"

    @classmethod
    def _create_tenant(cls, schema_name, domain, email, suffix):
        tenant = EmpresaTenant(
            schema_name=schema_name,
            nombre=f"Tenant Isolation {suffix}",
            slug_subdominio=schema_name,
            email_admin=email,
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        tenant.save(verbosity=0)
        tenant_domain = get_tenant_domain_model()(tenant=tenant, domain=domain)
        tenant_domain.save()
        return tenant, tenant_domain

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command(
            "migrate_schemas",
            schema_name=get_public_schema_name(),
            interactive=False,
            verbosity=0,
        )
        cls.tenant_a, cls.domain_a = cls._create_tenant(
            cls.tenant_a_schema_name,
            cls.tenant_a_domain,
            cls.tenant_a_email,
            "A",
        )
        cls.tenant_b, cls.domain_b = cls._create_tenant(
            cls.tenant_b_schema_name,
            cls.tenant_b_domain,
            cls.tenant_b_email,
            "B",
        )

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        cls.domain_a.delete()
        cls.domain_b.delete()
        cls.tenant_a.delete(force_drop=True)
        cls.tenant_b.delete(force_drop=True)
        super().tearDownClass()

    def tearDown(self):
        connection.set_schema_to_public()
        super().tearDown()
