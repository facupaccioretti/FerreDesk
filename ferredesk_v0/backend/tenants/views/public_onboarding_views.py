"""Views publicas del onboarding SaaS."""

from django.db import connection
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.serializers import (
    CrearTenantOnboardingSerializer,
    ValidarSlugOnboardingSerializer,
)
from tenants.services import crear_tenant_completo
from tenants.services.servicio_constructor_tenant import _construir_dominio_primario


def _esquema_publico_activo():
    return getattr(connection, "schema_name", "public") == "public"


class ValidarSlugOnboardingAPIView(APIView):
    """
    Endpoint publico para validar disponibilidad de subdominio antes del alta.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _esquema_publico_activo():
            return Response(
                {
                    "detail": "El onboarding SaaS solo puede ejecutarse desde el schema publico."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ValidarSlugOnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slug = serializer.validated_data["slug"]

        return Response(
            {
                "slug": slug,
                "disponible": True,
                "dominio_sugerido": _construir_dominio_primario(slug),
            },
            status=status.HTTP_200_OK,
        )


class CrearTenantOnboardingAPIView(APIView):
    """
    Endpoint publico para crear un tenant completo desde el schema publico.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _esquema_publico_activo():
            return Response(
                {
                    "detail": "El onboarding SaaS solo puede ejecutarse desde el schema publico."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CrearTenantOnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resultado = crear_tenant_completo(
            nombre=serializer.validated_data["nombre"],
            slug=serializer.validated_data["slug"],
            email=serializer.validated_data["email_admin"],
            password=serializer.validated_data["password"],
        )

        return Response(
            serializer.to_respuesta(resultado),
            status=status.HTTP_201_CREATED,
        )


class RegistroSaaSAPIView(CrearTenantOnboardingAPIView):
    """Alias publico explicito para el alta SaaS inicial."""
