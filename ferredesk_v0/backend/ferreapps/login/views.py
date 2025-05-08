from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login
import json
import os

# Create your views here.

def index(request):
    # Servir el index.html de React para todas las rutas
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