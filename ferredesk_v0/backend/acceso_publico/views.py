from django.db import connection
from rest_framework import exceptions, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from acceso_publico.serializers import LoginPublicoSerializer, PasswordResetPublicoSerializer
from acceso_publico.services import autenticar_cuenta_acceso_publico, solicitar_reset_cuenta_publica
from tenants.services.public_url_service import construir_url_tenant_publica


class BaseAccesoPublicoAPIView(APIView):
    """Base reservada para endpoints public/shared de acceso global."""


def _esquema_publico_activo():
    return getattr(connection, "schema_name", "public") == "public"


class LoginPublicoAPIView(BaseAccesoPublicoAPIView):
    """Login central de la plataforma publica contra CuentaAccesoPublico."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _esquema_publico_activo():
            return Response(
                {
                    "detail": "El login publico solo puede ejecutarse desde el schema publico."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = LoginPublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            resultado = autenticar_cuenta_acceso_publico(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        except exceptions.AuthenticationFailed as exc:
            error_code = exc.get_codes()
            if isinstance(error_code, list):
                error_code = error_code[0]
            return Response(
                {
                    "status": "error",
                    "message": str(exc.detail),
                    "error_code": error_code,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cuenta = resultado["cuenta"]
        tenant = resultado["tenant"]
        dominio = resultado["dominio"]

        return Response(
            {
                "status": "success",
                "message": "Login publico exitoso.",
                "cuenta": {
                    "email": cuenta.email,
                    "nombre_mostrar": cuenta.nombre_mostrar,
                },
                "tenant": {
                    "id": tenant.id,
                    "schema_name": tenant.schema_name,
                    "slug_subdominio": tenant.slug_subdominio,
                    "host": dominio.domain,
                    "url": construir_url_tenant_publica(host=dominio.domain, path="/"),
                },
                "bridge": resultado["bridge"],
                "token_puente": resultado["token_puente"],
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetPublicoAPIView(BaseAccesoPublicoAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _esquema_publico_activo():
            return Response(
                {
                    "detail": "El reset publico solo puede ejecutarse desde el schema publico."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PasswordResetPublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        solicitar_reset_cuenta_publica(
            email=serializer.validated_data["email"],
            use_https=request.is_secure(),
        )

        return Response(
            {
                "status": "success",
                "message": "Si el correo existe, enviamos instrucciones para restablecer la contrasena.",
            },
            status=status.HTTP_200_OK,
        )
