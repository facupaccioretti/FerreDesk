from django.shortcuts import redirect, render
from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.db import connection
import json
import os
from rest_framework import exceptions

from acceso_publico.services import validar_token_puente
from ferreapps.productos.setup import obtener_estado_setup_actual
from ferreapps.usuarios.models import CliUsuario
from ferreapps.usuarios.models import Usuario

# Create your views here.

# Las funciones serve_react_app y serve_static_file están definidas en ferredesk_backend/urls.py

@csrf_exempt
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

@csrf_exempt
def logout_view(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'status': 'success', 'message': 'Sesión cerrada'})
    return JsonResponse({'status': 'error', 'message': 'Método no permitido'}, status=405)

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


def login_bridge_view(request):
    if request.method != "GET":
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

    token = request.GET.get("token", "").strip()
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

    login(request, usuario)
    token_puente.marcar_usado()

    estado_setup = obtener_estado_setup_actual()
    destino = "/home" if estado_setup["setup_completo"] else "/setup"
    return redirect(destino)
