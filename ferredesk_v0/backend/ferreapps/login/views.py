from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
import json
import os
from ferreapps.usuarios.models import CliUsuario

# Create your views here.

def index(request):
    # Si el usuario NO está autenticado y está intentando acceder al dashboard, redirigir a la landing
    if not request.user.is_authenticated and request.path.startswith('/dashboard'):
        with open(os.path.join(settings.REACT_APP_DIR, 'index.html'), 'rb') as f:
            content = f.read()
            # Insertar el meta tag de redirección después del <head>
            content = content.replace(b'<head>', b'<head><meta name="x-redirect" content="/">')
            return FileResponse(content, content_type='text/html')
    
    # Para todas las demás rutas, servir el index.html de React
    index_path = os.path.join(settings.REACT_APP_DIR, 'index.html')
    return FileResponse(open(index_path, 'rb'))

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