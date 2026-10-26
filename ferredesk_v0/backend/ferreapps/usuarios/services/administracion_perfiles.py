from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from rest_framework import status

from ferreapps.usuarios.models import Perfil
from ferreapps.usuarios.permisos import (
    ORDEN_CATALOGO_PERMISOS,
    PLANTILLAS_PERMISOS,
    es_actor_dueno,
    expandir_dependencias,
)
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from ferreapps.usuarios.validators.perfiles import (
    calcular_actualizacion_permisos_delegada,
    es_actor_autorizado_administracion,
    validar_confirmacion_pin,
    validar_nombre_perfil,
    validar_nombre_unico_habilitado,
    validar_operacion_objetivo,
    validar_permisos_catalogo,
    validar_pin,
)
from ferredesk_backend.utils.exceptions import ErrorFuncional


CONSTRAINT_NOMBRE_PERFIL = 'usuarios_perfil_nombre_unico_habilitados'


def _es_conflicto_nombre_perfil(error):
    causa = getattr(error, '__cause__', None)
    diagnostico = getattr(causa, 'diag', None)
    if getattr(diagnostico, 'constraint_name', None) == CONSTRAINT_NOMBRE_PERFIL:
        return True
    return CONSTRAINT_NOMBRE_PERFIL in str(error)


def _error_nombre_perfil_en_uso():
    return ErrorFuncional(
        status.HTTP_409_CONFLICT,
        'nombre_perfil_en_uso',
        'Ya existe un perfil habilitado con ese nombre.',
        fields={'nombre': ['Ya existe un perfil habilitado con ese nombre.']},
    )


def crear_perfil(
    actor,
    *,
    nombre,
    pin,
    confirmar_pin,
    permisos=(),
    plantilla_origen=None,
    puede_gestionar_perfiles=None,
):
    if not es_actor_autorizado_administracion(actor):
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'permiso_insuficiente',
            'No tenes permiso para realizar esta accion.',
        )

    actor_es_dueno = (
        getattr(actor, 'tipo', None) == 'TITULAR'
        or es_actor_dueno(actor)
    )

    if not actor_es_dueno and puede_gestionar_perfiles is not None:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'gestion_no_permitida',
            'Un administrador delegado no puede enviar la delegacion.',
        )

    nombre = validar_nombre_perfil(nombre)
    validar_pin(pin)
    validar_confirmacion_pin(pin, confirmar_pin)
    validar_permisos_catalogo(permisos)
    validar_nombre_unico_habilitado(nombre)

    if plantilla_origen:
        if plantilla_origen not in PLANTILLAS_PERMISOS:
            raise ErrorFuncional(
                status.HTTP_400_BAD_REQUEST,
                'payload_invalido',
                'Plantilla desconocida.',
                fields={'plantilla_origen': ['Plantilla desconocida.']},
            )

    permisos_enviados = set(permisos or ())
    if not actor_es_dueno:
        delegado_permisos = set(getattr(actor.perfil, 'permisos', ()) or ())
        permisos_enviados, no_otorgables = calcular_actualizacion_permisos_delegada(
            permisos_enviados,
            delegado_permisos,
        )
        if no_otorgables:
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_no_otorgable',
                'No podes otorgar permisos que no posees.',
                fields={'permisos': sorted(no_otorgables)},
            )

    expandidos = expandir_dependencias(permisos_enviados)
    permisos_ordenados = [p for p in ORDEN_CATALOGO_PERMISOS if p in expandidos]

    try:
        with transaction.atomic():
            perfil = Perfil.objects.create(
                tipo=Perfil.TIPO_ORDINARIO,
                nombre=nombre,
                habilitado=True,
                puede_gestionar_perfiles=bool(puede_gestionar_perfiles),
                permisos=permisos_ordenados,
                pin_hash=make_password(pin),
                credencial_version=1,
            )
            registrar_evento_seguridad(
                evento='perfil_creado',
                actor=actor,
                objeto_tipo='Perfil',
                objeto_id=perfil.pk,
                detalles={'nombre': perfil.nombre},
            )
            if plantilla_origen:
                registrar_evento_seguridad(
                    evento='plantilla_aplicada',
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                    detalles={'plantilla': plantilla_origen},
                )
            if bool(puede_gestionar_perfiles):
                registrar_evento_seguridad(
                    evento='delegacion_concedida',
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                )
    except IntegrityError as error:
        if not _es_conflicto_nombre_perfil(error):
            raise
        raise _error_nombre_perfil_en_uso() from error

    return perfil


def modificar_perfil(actor, *, perfil, datos):
    if not es_actor_autorizado_administracion(actor):
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'permiso_insuficiente',
            'No tenes permiso para realizar esta accion.',
        )

    actor_es_dueno = (
        getattr(actor, 'tipo', None) == 'TITULAR'
        or es_actor_dueno(actor)
    )
    actor_perfil = getattr(actor, 'perfil', None)

    validar_operacion_objetivo(actor, perfil)

    cambios_a_aplicar = {}

    if 'nombre' in datos:
        validar_operacion_objetivo(actor, perfil, 'editar_nombre')
        nuevo_nombre = validar_nombre_perfil(datos['nombre'])
        validar_nombre_unico_habilitado(nuevo_nombre, perfil_id=perfil.pk)
        cambios_a_aplicar['nombre'] = nuevo_nombre

    if 'habilitado' in datos:
        validar_operacion_objetivo(actor, perfil, 'cambiar_habilitado')
        nuevo_habilitado = bool(datos['habilitado'])
        if nuevo_habilitado and not perfil.habilitado:
            nombre_a_verificar = cambios_a_aplicar.get('nombre', perfil.nombre)
            validar_nombre_unico_habilitado(nombre_a_verificar, perfil_id=perfil.pk)
        cambios_a_aplicar['habilitado'] = nuevo_habilitado

    if 'puede_gestionar_perfiles' in datos:
        validar_operacion_objetivo(actor, perfil, 'cambiar_delegacion')
        cambios_a_aplicar['puede_gestionar_perfiles'] = bool(datos['puede_gestionar_perfiles'])

    if 'permisos' in datos:
        validar_operacion_objetivo(actor, perfil, 'editar_permisos')
        validar_permisos_catalogo(datos['permisos'])
        permisos_enviados = set(datos['permisos'])

        if not actor_es_dueno:
            delegado_permisos = set(getattr(actor_perfil, 'permisos', ()) or ())
            objetivo_permisos = set(perfil.permisos or ())
            preservados, no_otorgables = calcular_actualizacion_permisos_delegada(
                permisos_enviados,
                delegado_permisos,
                objetivo_permisos,
            )
            if no_otorgables:
                raise ErrorFuncional(
                    status.HTTP_403_FORBIDDEN,
                    'permiso_no_otorgable',
                    'No podes otorgar permisos que no posees.',
                    fields={'permisos': sorted(no_otorgables)},
                )
            expandidos = expandir_dependencias(preservados)
            cambios_a_aplicar['permisos'] = [p for p in ORDEN_CATALOGO_PERMISOS if p in expandidos]
        else:
            expandidos = expandir_dependencias(permisos_enviados)
            cambios_a_aplicar['permisos'] = [p for p in ORDEN_CATALOGO_PERMISOS if p in expandidos]

    if 'plantilla_origen' in datos:
        validar_operacion_objetivo(actor, perfil, 'editar_permisos')
    plantilla_origen = datos.get('plantilla_origen')
    if plantilla_origen:
        if plantilla_origen not in PLANTILLAS_PERMISOS:
            raise ErrorFuncional(
                status.HTTP_400_BAD_REQUEST,
                'payload_invalido',
                'Plantilla desconocida.',
                fields={'plantilla_origen': ['Plantilla desconocida.']},
            )

    try:
        with transaction.atomic():
            if 'nombre' in cambios_a_aplicar and cambios_a_aplicar['nombre'] != perfil.nombre:
                nombre_ant = perfil.nombre
                perfil.nombre = cambios_a_aplicar['nombre']
                registrar_evento_seguridad(
                    evento='perfil_renombrado',
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                    detalles={
                        'perfil_id': perfil.pk,
                        'nombre_anterior': nombre_ant,
                        'nombre_nuevo': perfil.nombre,
                    },
                )

            if 'habilitado' in cambios_a_aplicar and cambios_a_aplicar['habilitado'] != perfil.habilitado:
                perfil.habilitado = cambios_a_aplicar['habilitado']
                perfil.credencial_version += 1
                ev = 'perfil_habilitado' if perfil.habilitado else 'perfil_deshabilitado'
                registrar_evento_seguridad(
                    evento=ev,
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                )

            if (
                'puede_gestionar_perfiles' in cambios_a_aplicar
                and cambios_a_aplicar['puede_gestionar_perfiles'] != perfil.puede_gestionar_perfiles
            ):
                perfil.puede_gestionar_perfiles = cambios_a_aplicar['puede_gestionar_perfiles']
                perfil.credencial_version += 1
                ev = 'delegacion_concedida' if perfil.puede_gestionar_perfiles else 'delegacion_retirada'
                registrar_evento_seguridad(
                    evento=ev,
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                )

            if 'permisos' in cambios_a_aplicar and set(cambios_a_aplicar['permisos']) != set(perfil.permisos):
                permisos_ant = list(perfil.permisos)
                perfil.permisos = cambios_a_aplicar['permisos']
                perfil.credencial_version += 1
                registrar_evento_seguridad(
                    evento='permisos_modificados',
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                    detalles={'permisos_anteriores': permisos_ant, 'permisos_nuevos': perfil.permisos},
                )

            if plantilla_origen:
                registrar_evento_seguridad(
                    evento='plantilla_aplicada',
                    actor=actor,
                    objeto_tipo='Perfil',
                    objeto_id=perfil.pk,
                    detalles={'plantilla': plantilla_origen},
                )

            perfil.save()
    except IntegrityError as error:
        if not _es_conflicto_nombre_perfil(error):
            raise
        raise _error_nombre_perfil_en_uso() from error

    return perfil


def eliminar_perfil(actor, *, perfil):
    if not es_actor_autorizado_administracion(actor):
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'permiso_insuficiente',
            'No tenes permiso para realizar esta accion.',
        )

    validar_operacion_objetivo(actor, perfil, 'eliminar')

    try:
        with transaction.atomic():
            perfil_id = perfil.pk
            nombre_eliminado = perfil.nombre
            perfil.delete()
            registrar_evento_seguridad(
                evento='perfil_eliminado',
                actor=actor,
                objeto_tipo='Perfil',
                objeto_id=perfil_id,
                detalles={'nombre': nombre_eliminado},
            )
    except ProtectedError:
        raise ErrorFuncional(
            status.HTTP_409_CONFLICT,
            'perfil_con_historial',
            'No se puede eliminar un perfil con historial comercial.',
            fields={},
        )
