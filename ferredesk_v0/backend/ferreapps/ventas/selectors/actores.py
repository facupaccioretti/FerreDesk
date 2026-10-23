from decimal import Decimal

from django.db.models import Q, Sum

from ferreapps.usuarios.models import ActorTipo, Perfil


def filtrar_por_actor(queryset, *, perfil_id=None, tipo=None):
    if tipo:
        queryset = queryset.filter(actor_tipo=tipo)
    if perfil_id:
        es_dueno = Perfil.objects.filter(pk=perfil_id, tipo=Perfil.TIPO_DUENO).exists()
        if es_dueno and tipo != ActorTipo.PERFIL:
            queryset = queryset.filter(
                Q(actor_perfil_id=perfil_id) | Q(actor_tipo=ActorTipo.TITULAR)
            )
        else:
            queryset = queryset.filter(actor_perfil_id=perfil_id)
    return queryset


def totales_por_actor(queryset):
    total_negocio = _total(queryset)
    grupos = {}
    dueno = Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).only('pk').first()
    if dueno is None:
        grupos[ActorTipo.TITULAR] = _total(queryset.filter(actor_tipo=ActorTipo.TITULAR))
    else:
        grupos[f'PERFIL:{dueno.pk}'] = _total(
            queryset.filter(Q(actor_perfil=dueno) | Q(actor_tipo=ActorTipo.TITULAR))
        )
    por_perfil = (
        queryset.filter(actor_tipo=ActorTipo.PERFIL)
        .order_by()
        .values('actor_perfil_id')
        .annotate(total=Sum('total_guardado'))
    )
    for fila in por_perfil:
        perfil_id = fila['actor_perfil_id']
        if dueno is not None and perfil_id == dueno.pk:
            continue
        grupos[f'PERFIL:{perfil_id}'] = fila['total'] or Decimal('0.00')
    grupos[ActorTipo.SISTEMA] = _total(queryset.filter(actor_tipo=ActorTipo.SISTEMA))
    return {
        'grupos': grupos,
        'total_negocio': total_negocio,
        'total_grupos': sum(grupos.values(), Decimal('0.00')),
    }


def _total(queryset):
    return queryset.aggregate(total=Sum('total_guardado'))['total'] or Decimal('0.00')
