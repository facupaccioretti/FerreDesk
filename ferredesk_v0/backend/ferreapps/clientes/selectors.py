from django.shortcuts import get_object_or_404

from ferreapps.usuarios.permisos import evaluar_permiso
from ferreapps.usuarios.services.actor_service import resolver_actor_http

from .models import Cliente


def puede_ver_clientes_restringidos(request):
    actor = resolver_actor_http(request)
    return actor is not None and evaluar_permiso(actor, 'clientes.ver_restringidos')


def clientes_visibles(request, queryset=None):
    queryset = queryset if queryset is not None else Cliente.objects.all()
    if puede_ver_clientes_restringidos(request):
        return queryset
    return queryset.filter(restringido=False)


def filtrar_por_cliente_visible(queryset, request, campo_cliente):
    if puede_ver_clientes_restringidos(request):
        return queryset
    return queryset.exclude(**{f'{campo_cliente}__restringido': True})


def cliente_visible_or_404(request, **filtros):
    return get_object_or_404(clientes_visibles(request), **filtros)


def objeto_con_cliente_visible_or_404(queryset, request, campo_cliente, **filtros):
    queryset = filtrar_por_cliente_visible(queryset, request, campo_cliente)
    return get_object_or_404(queryset, **filtros)
