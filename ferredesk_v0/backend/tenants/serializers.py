"""Serializers publicos para onboarding SaaS."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from acceso_publico.models import CuentaAccesoPublico
from tenants.services.servicio_constructor_tenant import _obtener_dominio_base
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
                "url": f"http://{dominio.domain}",
                "is_primary": dominio.is_primary,
                "dominio_base": _obtener_dominio_base(),
            },
            "admin_inicial": {
                "username": usuario.username,
                "email": usuario.email,
                "tipo_usuario": usuario.tipo_usuario,
            },
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
