from datetime import datetime, timezone as datetime_timezone

from django.db.models import Case, IntegerField, Value, When
from django.db.models.functions import Lower
from django.utils import timezone

from ferreapps.usuarios.models import Perfil
from ferreapps.usuarios.services.sesion_operativa import (
    CLAVE_DUENO_ESPERA_HASTA,
    CLAVE_DUENO_VERSION,
)


def _orden_perfiles(queryset):
    return queryset.annotate(
        orden_tipo=Case(
            When(tipo=Perfil.TIPO_DUENO, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by('orden_tipo', Lower('nombre'), 'pk')


def seleccionar_perfiles_habilitados(request):
    ahora = timezone.now()
    perfiles = _orden_perfiles(Perfil.objects.filter(habilitado=True))
    resultado = []
    for perfil in perfiles:
        espera_hasta = None
        if perfil.tipo == Perfil.TIPO_DUENO:
            if request.session.get(CLAVE_DUENO_VERSION) == perfil.credencial_version:
                marca = float(request.session.get(CLAVE_DUENO_ESPERA_HASTA, 0) or 0)
                if marca > ahora.timestamp():
                    espera_hasta = datetime.fromtimestamp(marca, tz=datetime_timezone.utc)
        elif perfil.bloqueado_hasta and perfil.bloqueado_hasta > ahora:
            espera_hasta = perfil.bloqueado_hasta
        resultado.append((perfil, espera_hasta))
    return resultado


def seleccionar_opciones_actor():
    return _orden_perfiles(Perfil.objects.all())


def serializar_perfil_admin(actor, perfil):
    from ferreapps.usuarios.permisos import ORDEN_CATALOGO_PERMISOS
    from ferreapps.usuarios.validators.perfiles import (
        calcular_acciones_permitidas,
        calcular_permisos_no_editables,
    )

    es_dueno = perfil.tipo == Perfil.TIPO_DUENO
    return {
        'id': perfil.pk,
        'nombre': perfil.nombre,
        'etiqueta': perfil.etiqueta,
        'tipo': perfil.tipo,
        'es_dueno': es_dueno,
        'habilitado': perfil.habilitado,
        'puede_gestionar_perfiles': perfil.puede_gestionar_perfiles if not es_dueno else False,
        'acceso_total': es_dueno,
        'permisos': None if es_dueno else [p for p in ORDEN_CATALOGO_PERMISOS if p in (perfil.permisos or [])],
        'permisos_no_editables': calcular_permisos_no_editables(actor, perfil),
        'bloqueado_hasta': perfil.bloqueado_hasta.isoformat() if perfil.bloqueado_hasta else None,
        'acciones_permitidas': calcular_acciones_permitidas(actor, perfil),
        'creado_en': perfil.creado_en.isoformat(),
        'actualizado_en': perfil.actualizado_en.isoformat(),
    }


def seleccionar_perfiles_admin(actor, *, incluir_deshabilitados=False):
    queryset = Perfil.objects.all()
    if not incluir_deshabilitados:
        queryset = queryset.filter(habilitado=True)
    perfiles = _orden_perfiles(queryset)
    return [serializar_perfil_admin(actor, p) for p in perfiles]


def obtener_perfil_admin(actor, perfil_id):
    from ferredesk_backend.utils.exceptions import ErrorFuncional
    from rest_framework import status
    try:
        perfil = Perfil.objects.get(pk=perfil_id)
    except (Perfil.DoesNotExist, ValueError, TypeError):
        raise ErrorFuncional(
            status.HTTP_404_NOT_FOUND,
            'perfil_no_encontrado',
            'Perfil no encontrado.',
        )
    return serializar_perfil_admin(actor, perfil)
