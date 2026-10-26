from django.conf import settings

from ferreapps.usuarios.models import ActorTipo, Perfil
from ferreapps.usuarios.permisos import CATALOGO_PERMISOS, es_actor_dueno, evaluar_permiso
from ferreapps.usuarios.selectors.adopcion import perfiles_adoptados
from ferreapps.usuarios.services.actor_service import resolver_actor_http


def _perfil_resumen(perfil):
    if perfil is None:
        return None
    return {
        'id': perfil.pk,
        'nombre': perfil.nombre,
        'etiqueta': perfil.etiqueta,
        'tipo': perfil.tipo,
        'es_dueno': perfil.tipo == Perfil.TIPO_DUENO,
    }


def _capacidades(actor, adoptados):
    es_titular = actor is not None and actor.tipo == ActorTipo.TITULAR
    dueno = es_actor_dueno(actor)
    perfil = getattr(actor, 'perfil', None)
    puede_gestionar = dueno or bool(
        perfil is not None and perfil.puede_gestionar_perfiles
    )
    return {
        'puede_activar_perfiles': bool(
            settings.PERFILES_ROLLOUT_HABILITADO and not adoptados and es_titular
        ),
        'puede_gestionar_perfiles': puede_gestionar,
        'puede_restablecer_pin_ajeno': dueno,
        'puede_cerrar_sesion_negocio': es_titular or dueno,
        'puede_gestionar_restriccion_clientes': es_titular or dueno,
    }


def construir_estado_sesion(request):
    adoptados = perfiles_adoptados(request)
    actor = resolver_actor_http(request)
    perfil = getattr(actor, 'perfil', None) if actor is not None else None
    permisos = []
    if actor is not None:
        permisos = sorted(
            permiso
            for permiso in CATALOGO_PERMISOS
            if evaluar_permiso(actor, permiso)
        )

    return {
        'cuenta': {
            'username': request.user.username,
            'is_staff': request.user.is_staff,
        },
        'perfiles_adoptados': adoptados,
        'requiere_identificacion': adoptados and perfil is None,
        'motivo_requiere_identificacion': (
            request.session.get('perfil_salida_motivo') if adoptados and perfil is None else None
        ),
        'actor_tipo': actor.tipo if actor is not None else None,
        'perfil_activo': _perfil_resumen(perfil),
        'permisos_efectivos': permisos,
        'inactividad_segundos': (
            settings.PERFIL_INACTIVIDAD_SEGUNDOS if adoptados else None
        ),
        'capacidades': _capacidades(actor, adoptados),
    }
