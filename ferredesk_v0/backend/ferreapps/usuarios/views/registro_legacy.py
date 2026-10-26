from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@csrf_exempt
@require_POST
def register(request):
    return JsonResponse({
        "status": "error",
        "code": "register_retirado",
        "message": "El registro directo de usuarios fue retirado.",
        "fields": {},
    }, status=410)


register.allowed_methods = ('POST',)
register.exencion_permiso = 'deprecada'
register.metodos_deprecados = ('POST',)
register.retiro_deprecado_en = '7'
register.corte_permisos = '3.11'
