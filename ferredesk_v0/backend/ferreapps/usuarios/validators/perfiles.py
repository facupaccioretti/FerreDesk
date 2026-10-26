import re

from rest_framework import status

from ferredesk_backend.utils.exceptions import ErrorFuncional


PATRON_PIN = re.compile(r'^[0-9]{6}$')


def normalizar_nombre_perfil(nombre):
    return ' '.join((nombre or '').strip().split())


def validar_nombre_perfil(nombre):
    nombre = normalizar_nombre_perfil(nombre)
    if not 1 <= len(nombre) <= 60:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'payload_invalido',
            'El nombre debe tener entre 1 y 60 caracteres.',
            fields={'nombre': ['El nombre debe tener entre 1 y 60 caracteres.']},
        )
    reservado = nombre.casefold()
    if reservado in {'dueño', 'dueno'} or reservado.startswith(('dueño (', 'dueno (')):
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'nombre_reservado',
            'El nombre esta reservado.',
            fields={'nombre': ['El nombre esta reservado.']},
        )
    return nombre


def validar_pin(pin, *, campo='pin'):
    if not isinstance(pin, str) or PATRON_PIN.fullmatch(pin) is None:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'pin_invalido',
            'El PIN debe tener exactamente 6 digitos.',
            fields={campo: ['El PIN debe tener exactamente 6 digitos.']},
        )
    return pin


def validar_confirmacion_pin(pin, confirmar_pin):
    if pin != confirmar_pin:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'pin_confirmacion_distinta',
            'La confirmacion del PIN no coincide.',
            fields={'confirmar_pin': ['La confirmacion del PIN no coincide.']},
        )


def validar_nombre_unico_habilitado(nombre, perfil_id=None):
    from ferreapps.usuarios.models import Perfil
    queryset = Perfil.objects.filter(habilitado=True, nombre__iexact=nombre)
    if perfil_id is not None:
        queryset = queryset.exclude(pk=perfil_id)
    if queryset.exists():
        raise ErrorFuncional(
            status.HTTP_409_CONFLICT,
            'nombre_perfil_en_uso',
            'Ya existe un perfil habilitado con ese nombre.',
            fields={'nombre': ['Ya existe un perfil habilitado con ese nombre.']},
        )


def validar_permisos_catalogo(permisos):
    from ferreapps.usuarios.permisos import CATALOGO_PERMISOS
    if not isinstance(permisos, (list, tuple, set, frozenset)):
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'payload_invalido',
            'Los permisos deben ser una lista.',
            fields={'permisos': ['Los permisos deben ser una lista.']},
        )
    desconocidos = set(permisos) - CATALOGO_PERMISOS
    if desconocidos:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'permiso_desconocido',
            f'Permisos desconocidos: {sorted(desconocidos)}',
            fields={'permisos': [f'Permisos desconocidos: {sorted(desconocidos)}']},
        )


def es_actor_autorizado_administracion(actor):
    from ferreapps.usuarios.permisos import es_actor_dueno
    if actor is None:
        return False
    if getattr(actor, 'tipo', None) == 'TITULAR':
        return True
    if es_actor_dueno(actor):
        return True
    perfil = getattr(actor, 'perfil', None)
    if (
        perfil is not None
        and getattr(perfil, 'habilitado', False)
        and getattr(perfil, 'puede_gestionar_perfiles', False)
    ):
        return True
    return False


def calcular_acciones_permitidas(actor, objetivo):
    todas_falsas = {
        'editar_nombre': False,
        'editar_permisos': False,
        'cambiar_habilitado': False,
        'cambiar_delegacion': False,
        'restablecer_pin': False,
        'eliminar': False,
    }
    if not es_actor_autorizado_administracion(actor):
        return todas_falsas

    from ferreapps.usuarios.models import Perfil
    from ferreapps.usuarios.permisos import es_actor_dueno

    actor_es_dueno = (
        getattr(actor, 'tipo', None) == 'TITULAR'
        or es_actor_dueno(actor)
    )
    objetivo_es_dueno = getattr(objetivo, 'tipo', None) == Perfil.TIPO_DUENO
    actor_perfil = getattr(actor, 'perfil', None)
    mismo_perfil = (
        actor_perfil is not None
        and getattr(objetivo, 'pk', None) == actor_perfil.pk
    )

    if actor_es_dueno:
        if objetivo_es_dueno or mismo_perfil:
            # Dueño sobre si mismo: solo editar_nombre
            return {
                'editar_nombre': True,
                'editar_permisos': False,
                'cambiar_habilitado': False,
                'cambiar_delegacion': False,
                'restablecer_pin': False,
                'eliminar': False,
            }
        # Dueño sobre cualquier ordinario (delegado o no)
        return {
            'editar_nombre': True,
            'editar_permisos': True,
            'cambiar_habilitado': True,
            'cambiar_delegacion': True,
            'restablecer_pin': True,
            'eliminar': True,
        }

    # Actor es delegado.
    if objetivo_es_dueno or mismo_perfil or getattr(objetivo, 'puede_gestionar_perfiles', False):
        # Delegado sobre Dueño, sobre si mismo o sobre otro delegado: nada.
        return todas_falsas

    # Delegado sobre ordinario comun.
    return {
        'editar_nombre': True,
        'editar_permisos': True,
        'cambiar_habilitado': True,
        'cambiar_delegacion': False,
        'restablecer_pin': False,
        'eliminar': True,
    }


def calcular_permisos_no_editables(actor, objetivo):
    from ferreapps.usuarios.models import Perfil
    from ferreapps.usuarios.permisos import ORDEN_CATALOGO_PERMISOS, es_actor_dueno

    if getattr(objetivo, 'tipo', None) == Perfil.TIPO_DUENO:
        return []
    if getattr(actor, 'tipo', None) == 'TITULAR' or es_actor_dueno(actor):
        return []

    actor_perfil = getattr(actor, 'perfil', None)
    if actor_perfil is None or not getattr(actor_perfil, 'puede_gestionar_perfiles', False):
        return []

    # Delegado sobre objetivo ordinario comun.
    if getattr(objetivo, 'puede_gestionar_perfiles', False) or getattr(objetivo, 'pk', None) == actor_perfil.pk:
        return []

    delegado_permisos = set(getattr(actor_perfil, 'permisos', ()) or ())
    objetivo_permisos = set(getattr(objetivo, 'permisos', ()) or ())
    no_editables = calcular_permisos_no_editables_ids(
        objetivo_permisos,
        delegado_permisos,
    )
    return [p for p in ORDEN_CATALOGO_PERMISOS if p in no_editables]


def calcular_permisos_no_editables_ids(permisos_objetivo, permisos_delegado):
    return frozenset(permisos_objetivo) - frozenset(permisos_delegado)


def calcular_actualizacion_permisos_delegada(
    permisos_enviados,
    permisos_delegado,
    permisos_objetivo=(),
):
    enviados = frozenset(permisos_enviados)
    delegado = frozenset(permisos_delegado)
    objetivo = frozenset(permisos_objetivo)
    no_editables = calcular_permisos_no_editables_ids(objetivo, delegado)
    no_otorgables = enviados - delegado - objetivo
    resultado = (enviados & delegado) | no_editables
    return resultado, no_otorgables


def validar_operacion_objetivo(actor, objetivo, accion=None):
    acciones = calcular_acciones_permitidas(actor, objetivo)
    permitido = any(acciones.values()) if accion is None else acciones.get(accion, False)
    if not permitido:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'gestion_no_permitida',
            'No tenes permiso para realizar esta accion sobre el perfil objetivo.',
        )
