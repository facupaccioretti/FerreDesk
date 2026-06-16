from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.db import connection
import json
import os
from rest_framework import exceptions
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from acceso_publico.services import validar_token_puente
from ferreapps.login.password_reset_service import confirmar_reset_password_tenant, enviar_email_reset_tenant
from ferreapps.login.serializers import PasswordResetConfirmSerializer, PasswordResetRequestSerializer
from ferreapps.productos.setup import obtener_estado_setup_actual
from ferreapps.usuarios.models import CliUsuario
from ferreapps.usuarios.models import Usuario

# Create your views here.

# Las funciones serve_react_app y serve_static_file están definidas en ferredesk_backend/urls.py

def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                # Verificar si es un usuario cliente y si su cuenta está activa
                try:
                    cli_usuario = CliUsuario.objects.get(user=user)
                    if not cli_usuario.cuenta_activa:
                        return JsonResponse({
                            'status': 'error',
                            'message': 'La cuenta aún no está activada. Por favor, contacta al administrador.'
                        }, status=403)
                except CliUsuario.DoesNotExist:
                    pass  # Si no es un usuario cliente, permitir el login normalmente
                login(request, user)
                return JsonResponse({
                    'status': 'success',
                    'message': 'Login exitoso',
                    'user': {
                        'username': user.username,
                        'is_staff': user.is_staff,
                        # Agrega aquí más información del usuario que necesites
                    }
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Credenciales inválidas'
                }, status=401)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'status': 'error',
                'message': 'Datos inválidos'
            }, status=400)
            
    return JsonResponse({
        'status': 'error',
        'message': 'Método no permitido'
    }, status=405)

def logout_view(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'status': 'success', 'message': 'Sesión cerrada'})
    return JsonResponse({'status': 'error', 'message': 'Método no permitido'}, status=405)

@ensure_csrf_cookie
def get_csrf(request):
    """
    Endpoint para que el frontend obtenga la cookie CSRF.
    """
    return JsonResponse({
        'status': 'success',
        'message': 'CSRF cookie establecida',
        'csrfToken': get_token(request),
    })

@ensure_csrf_cookie
def user_view(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'status': 'success',
            'user': {
                'username': request.user.username,
                'is_staff': request.user.is_staff,
                # Agrega aquí más campos si lo deseas
            }
        })
    else:
        return JsonResponse({'status': 'error', 'message': 'No autenticado'}, status=401)


@csrf_exempt
def login_bridge_view(request):
    if request.method != "POST":
        return JsonResponse(
            {"status": "error", "message": "Método no permitido"},
            status=405,
        )

    schema_actual = getattr(connection, "schema_name", "public")
    if schema_actual == "public":
        return JsonResponse(
            {
                "status": "error",
                "message": "El login bridge solo puede ejecutarse dentro de un tenant.",
            },
            status=400,
        )

    token = request.POST.get("token", "").strip()
    if not token:
        return JsonResponse(
            {
                "status": "error",
                "message": "Token puente requerido.",
            },
            status=400,
        )

    try:
        token_puente = validar_token_puente(token=token, schema_name=schema_actual)
        usuario = Usuario.objects.get(username=token_puente.username_tenant)
    except exceptions.AuthenticationFailed as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc.detail),
            },
            status=401,
        )
    except Usuario.DoesNotExist:
        return JsonResponse(
            {
                "status": "error",
                "message": "Usuario tenant asociado al bridge no encontrado.",
            },
            status=404,
        )

    login(request, usuario, backend="django.contrib.auth.backends.ModelBackend")
    token_puente.marcar_usado()

    estado_setup = obtener_estado_setup_actual()
    destino = "/home" if estado_setup["setup_completo"] else "/setup"
    
    from django.shortcuts import redirect
    response = redirect(destino)
    response.status_code = 303
    return response


def password_reset_request_view(request):
    if request.method != "POST":
        return JsonResponse(
            {"status": "error", "message": "Metodo no permitido"},
            status=405,
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {"status": "error", "message": "Datos invalidos"},
            status=400,
        )

    serializer = PasswordResetRequestSerializer(data=data)
    if not serializer.is_valid():
        return JsonResponse(
            {"status": "error", "errors": serializer.errors},
            status=400,
        )

    tenant_actual = getattr(request, "tenant", None) or getattr(connection, "tenant", None)
    if tenant_actual is None or getattr(tenant_actual, "schema_name", "public") == "public":
        return JsonResponse(
            {
                "status": "error",
                "message": "No se pudo resolver el tenant actual para construir el enlace de recuperacion.",
            },
            status=400,
        )

    dominio_primario = tenant_actual.get_primary_domain()
    if dominio_primario is None or not dominio_primario.domain:
        return JsonResponse(
            {
                "status": "error",
                "message": "El tenant actual no tiene un dominio primario configurado.",
            },
            status=400,
        )

    enviar_email_reset_tenant(
        email=serializer.validated_data["email"],
        domain=dominio_primario.domain,
        use_https=True,
    )
    return JsonResponse(
        {
            "status": "success",
            "message": "Si el correo existe, enviamos instrucciones para restablecer la contrasena.",
        }
    )


class PasswordResetConfirmAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        confirmar_reset_password_tenant(
            uid=serializer.validated_data["uid"],
            token=serializer.validated_data["token"],
            new_password1=serializer.validated_data["new_password1"],
            new_password2=serializer.validated_data["new_password2"],
        )

        return Response(
            {
                "status": "success",
                "message": "La contrasena fue actualizada correctamente.",
            },
            status=status.HTTP_200_OK,
        )
