"""Serializers publicos para onboarding SaaS."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from acceso_publico.models import CuentaAccesoPublico
from tenants.models import SolicitudOnboardingTenant
from tenants.services.servicio_constructor_tenant import _obtener_dominio_base
from tenants.services.public_url_service import construir_url_tenant_publica
from tenants.validators import validar_slug_completo, validar_slug_formato, validar_slug_no_reservado, validar_slug_unico


class ValidarSlugOnboardingSerializer(serializers.Serializer):
    slug = serializers.CharField(max_length=63)

    def validate_slug(self, value):
        slug = value.strip().lower()

        try:
            validar_slug_formato(slug)
            validar_slug_no_reservado(slug)
            validar_slug_unico(slug)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

        return slug


class CrearTenantOnboardingSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)
    slug = serializers.CharField(max_length=63)
    email_admin = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_nombre(self, value):
        nombre = value.strip()
        if not nombre:
            raise serializers.ValidationError("El nombre del negocio es obligatorio.")
        return nombre

    def validate_slug(self, value):
        slug = value.strip().lower()
        try:
            validar_slug_completo(slug)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return slug

    def validate_email_admin(self, value):
        email = value.strip().lower()

        # Politica V1: una cuenta global solo puede pertenecer a un tenant.
        if CuentaAccesoPublico.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta global con ese email. La beta V1 permite una sola empresa por cuenta."
            )

        return email

    def to_respuesta(self, resultado):
        tenant = resultado["tenant"]
        dominio = resultado["dominio"]
        usuario = resultado["usuario"]

        return {
            "tenant": {
                "id": tenant.id,
                "schema_name": tenant.schema_name,
                "nombre": tenant.nombre,
                "slug_subdominio": tenant.slug_subdominio,
                "email_admin": tenant.email_admin,
                "estado_suscripcion": tenant.estado_suscripcion,
                "activo": tenant.activo,
                "fecha_fin_prueba": tenant.fecha_fin_prueba.isoformat() if tenant.fecha_fin_prueba else None,
            },
            "dominio": {
                "host": dominio.domain,
                "url": construir_url_tenant_publica(host=dominio.domain, path="/"),
                "is_primary": dominio.is_primary,
                "dominio_base": _obtener_dominio_base(),
            },
            "admin_inicial": {
                "username": usuario.username,
                "email": usuario.email,
                "tipo_usuario": usuario.tipo_usuario,
            },
            "email_verificacion": resultado.get(
                "email_verificacion",
                {
                    "enviado": False,
                    "requiere_reenvio": True,
                    "mensaje": "",
                },
            ),
        }


class ActivarEmailOnboardingSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField(max_length=64)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_token(self, value):
        token = value.strip()
        if not token:
            raise serializers.ValidationError("El token es obligatorio.")
        return token


class ReenviarEmailOnboardingSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class SolicitudOnboardingEstadoSerializer(serializers.ModelSerializer):
    solicitud_id = serializers.IntegerField(source="id", read_only=True)
    tenant = serializers.SerializerMethodField()
    dominio = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudOnboardingTenant
        fields = (
            "solicitud_id",
            "estado",
            "error_codigo",
            "error_detalle",
            "intentos",
            "creado_en",
            "actualizado_en",
            "tenant",
            "dominio",
            "payload_resumen",
        )

    def get_tenant(self, instance):
        if instance.tenant_id is None:
            return None

        return {
            "id": instance.tenant.id,
            "schema_name": instance.tenant.schema_name,
            "slug_subdominio": instance.tenant.slug_subdominio,
            "estado_suscripcion": instance.tenant.estado_suscripcion,
        }

    def get_dominio(self, instance):
        if instance.tenant_id is None:
            return None

        dominio = instance.tenant.get_primary_domain()
        if dominio is None:
            return None

        return {
            "host": dominio.domain,
            "url": construir_url_tenant_publica(host=dominio.domain, path="/"),
        }
