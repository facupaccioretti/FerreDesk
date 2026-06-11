from django.db import models
from django_tenants.models import DomainMixin, TenantMixin


class EmpresaTenant(TenantMixin):
    """Tenant de plataforma para cada empresa aislada por schema."""

    ESTADO_SUSCRIPCION_TRIAL = "trial"
    ESTADO_SUSCRIPCION_ACTIVO = "activo"
    ESTADO_SUSCRIPCION_SUSPENDIDO = "suspendido"
    ESTADO_SUSCRIPCION_CANCELADO = "cancelado"

    ESTADOS_SUSCRIPCION = (
        (ESTADO_SUSCRIPCION_TRIAL, "Período de prueba"),
        (ESTADO_SUSCRIPCION_ACTIVO, "Activo"),
        (ESTADO_SUSCRIPCION_SUSPENDIDO, "Suspendido"),
        (ESTADO_SUSCRIPCION_CANCELADO, "Cancelado"),
    )

    nombre = models.CharField(max_length=200)
    slug_subdominio = models.SlugField(max_length=63, unique=True)
    email_admin = models.EmailField()
    estado_suscripcion = models.CharField(
        max_length=20,
        choices=ESTADOS_SUSCRIPCION,
        default=ESTADO_SUSCRIPCION_TRIAL,
    )
    fecha_fin_prueba = models.DateTimeField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    # django-tenants crea el schema automáticamente al persistir el tenant.
    auto_create_schema = True

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"


class Dominio(DomainMixin):
    """Dominio/subdominio asociado a una empresa tenant."""

    class Meta:
        verbose_name = "Dominio"
        verbose_name_plural = "Dominios"
