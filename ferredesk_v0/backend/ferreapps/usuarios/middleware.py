from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone

from ferreapps.usuarios.metadatos import perfil_operativo_exento
from ferreapps.usuarios.models import Perfil
from ferreapps.usuarios.selectors.adopcion import perfiles_adoptados
from ferreapps.usuarios.services.sesion_operativa import (
    CLAVE_CREDENCIAL_VERSION,
    CLAVE_IDENTIFICADO_EN,
    CLAVE_PERFIL_ID,
    CLAVE_ULTIMA_ACTIVIDAD,
    leer_instante_sesion,
    limpiar_identidad_operativa,
)
from ferredesk_backend.utils.exceptions import respuesta_error


MENSAJES_SALIDA = {
    'perfil_requerido': 'Se requiere identificar un perfil operativo.',
    'perfil_invalido': 'El perfil operativo ya no esta disponible.',
    'credencial_perfil_cambiada': 'La credencial del perfil fue modificada.',
    'perfil_expirado_por_inactividad': 'El perfil expiro por inactividad.',
}


class PerfilOperativoMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        request.perfil_operativo = None
        if getattr(connection, 'schema_name', 'public') == 'public':
            return None
        if not request.path_info.startswith('/api/'):
            return None
        if not getattr(request.user, 'is_authenticated', False):
            return None

        adoptados = perfiles_adoptados(request)
        if not adoptados:
            return None

        motivo_actual = None
        perfil_id = request.session.get(CLAVE_PERFIL_ID)
        if perfil_id is not None:
            perfil, motivo_actual = self._validar_perfil(request, perfil_id)
            if perfil is not None:
                request.perfil_operativo = perfil

        if perfil_operativo_exento(view_func, request.method):
            return None
        if request.perfil_operativo is not None:
            return None

        codigo = motivo_actual or 'perfil_requerido'
        return respuesta_error(403, codigo, MENSAJES_SALIDA[codigo])

    def _validar_perfil(self, request, perfil_id):
        try:
            perfil = Perfil.objects.select_related('usuario').get(pk=perfil_id)
        except (Perfil.DoesNotExist, TypeError, ValueError):
            return self._limpiar(request, perfil_id, 'perfil_invalido')

        if not perfil.habilitado:
            return self._limpiar(request, perfil_id, 'perfil_invalido')
        if request.session.get(CLAVE_CREDENCIAL_VERSION) != perfil.credencial_version:
            return self._limpiar(request, perfil_id, 'credencial_perfil_cambiada')

        actividad = leer_instante_sesion(
            request.session.get(CLAVE_ULTIMA_ACTIVIDAD)
            or request.session.get(CLAVE_IDENTIFICADO_EN)
        )
        if (
            actividad is None
            or timezone.now() - actividad
            > timedelta(seconds=settings.PERFIL_INACTIVIDAD_SEGUNDOS)
        ):
            return self._limpiar(
                request,
                perfil_id,
                'perfil_expirado_por_inactividad',
            )
        return perfil, None

    @staticmethod
    def _limpiar(request, perfil_id, motivo):
        limpiar_identidad_operativa(
            request.session,
            motivo=motivo,
            perfil_id=perfil_id,
        )
        return None, motivo
