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

