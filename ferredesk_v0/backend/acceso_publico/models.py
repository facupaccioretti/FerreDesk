from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.db import connection
from django.utils import timezone
import secrets


class CuentaAccesoPublico(models.Model):
    """Cuenta global minima alojada en el schema public."""

    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    nombre_mostrar = models.CharField(max_length=150)
    username_tenant = models.CharField(max_length=150)
    email_tenant = models.EmailField()
    tenant_asignado = models.ForeignKey(
        "tenants.EmpresaTenant",
        on_delete=models.PROTECT,
        related_name="cuentas_acceso_publico",
    )
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultimo_acceso = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Cuenta de acceso publico"
        verbose_name_plural = "Cuentas de acceso publico"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return self.email

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def registrar_acceso(self):
        self.ultimo_acceso = timezone.now()
        self.save(update_fields=["ultimo_acceso"])

    def obtener_identidad_tenant(self):
        """Retorna los datos minimos para abrir el bridge en el tenant."""
        return {
            "schema_name": self.tenant_asignado.schema_name,
            "username_tenant": self.username_tenant,
            "email_tenant": self.email_tenant,
        }

    def resolver_usuario_tenant(self):
        """
        Resuelve el admin tenant por username dentro del schema activo del tenant.

        Debe ejecutarse luego de cambiar el contexto al schema de ``tenant_asignado``.
        """
        schema_actual = getattr(connection, "schema_name", None)
        if schema_actual != self.tenant_asignado.schema_name:
            raise ImproperlyConfigured(
                "resolver_usuario_tenant() debe ejecutarse dentro del schema "
                f"'{self.tenant_asignado.schema_name}', no en '{schema_actual}'."
            )

        from ferreapps.usuarios.models import Usuario

        return Usuario.objects.get(username=self.username_tenant)


class TokenPuenteAcceso(models.Model):
    """Token efimero de un solo uso para abrir la sesion tenant."""

    token = models.CharField(max_length=128, unique=True, default=secrets.token_urlsafe)
    cuenta = models.ForeignKey(
        "acceso_publico.CuentaAccesoPublico",
        on_delete=models.CASCADE,
        related_name="tokens_puente",
    )
    tenant_asignado = models.ForeignKey(
        "tenants.EmpresaTenant",
        on_delete=models.CASCADE,
        related_name="tokens_puente_acceso",
    )
    username_tenant = models.CharField(max_length=150)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)
    usado_en = models.DateTimeField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Token puente de acceso"
        verbose_name_plural = "Tokens puente de acceso"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.tenant_asignado.schema_name}:{self.username_tenant}"

    def esta_expirado(self):
        return timezone.now() >= self.expira_en

    def marcar_usado(self):
        self.usado = True
        self.usado_en = timezone.now()
        self.save(update_fields=["usado", "usado_en"])
