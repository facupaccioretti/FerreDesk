from django.shortcuts import render
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password
from .models import CliUsuario
import json

# Create your views here.

User = get_user_model()

@csrf_exempt
def register(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            
            # Verificar si el usuario ya existe
            if User.objects.filter(username=username).exists():
                return JsonResponse({
                    'status': 'error',
                    'message': 'El nombre de usuario ya está en uso'
                }, status=400)
            
            if User.objects.filter(email=email).exists():
                return JsonResponse({
                    'status': 'error',
                    'message': 'El correo electrónico ya está registrado'
                }, status=400)
            
            # Crear el usuario
            user = User.objects.create(
                username=username,
                email=email,
                password=make_password(password)
            )
            
            # Crear el perfil de cliente
            CliUsuario.objects.create(
                user=user,
                cuenta_activa=True  # La cuenta se activa automáticamente al registrarse
            )
            
            return JsonResponse({
                'status': 'success',
                'message': 'Usuario registrado exitosamente. Ya puedes iniciar sesión.'
            })
            
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=400)
    
    return JsonResponse({
        'status': 'error',
        'message': 'Método no permitido'
    }, status=405)
