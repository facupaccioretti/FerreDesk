from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from django.shortcuts import render

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        if username == 'admin' and password == 'admin':
            return JsonResponse({'success': True, 'message': 'Login correcto'})
        else:
            return JsonResponse({'success': False, 'message': 'Credenciales inválidas'})
    return JsonResponse({'error': 'Método no permitido'}, status=405)