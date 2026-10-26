from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ferreapps.usuarios.models import Perfil
from ferreapps.usuarios.permisos import obtener_catalogo_permisos
from ferreapps.usuarios.selectors.perfiles import (
    obtener_perfil_admin,
    seleccionar_perfiles_admin,
    serializar_perfil_admin,
)
from ferreapps.usuarios.serializers.administracion import (
    CrearPerfilInputSerializer,
    ModificarPerfilInputSerializer,
)
from ferreapps.usuarios.services.actor_service import resolver_actor_http
from ferreapps.usuarios.services.administracion_perfiles import (
    crear_perfil,
    eliminar_perfil,
    modificar_perfil,
)
from ferreapps.usuarios.validators.acceso_http import validar_perfil_esperado
from ferreapps.usuarios.validators.perfiles import es_actor_autorizado_administracion
from ferredesk_backend.utils.exceptions import ErrorFuncional


def _validar_datos(serializer_cls, data, partial=False):
    serializer = serializer_cls(data=data, partial=partial)
    if not serializer.is_valid():
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'payload_invalido',
            'Los datos enviados no son validos.',
            fields=serializer.errors,
        )
    return serializer.validated_data


class CatalogoPermisosAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    corte_permisos = '4.3'

    def get(self, request):
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        return Response(obtener_catalogo_permisos(actor))


class PerfilesAdminListCreateAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    corte_permisos = '4.3'

    def get(self, request):
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        incluir_deshabilitados = (
            request.query_params.get('incluir_deshabilitados', '').lower() in {'true', '1'}
        )
        return Response(
            seleccionar_perfiles_admin(
                actor,
                incluir_deshabilitados=incluir_deshabilitados,
            )
        )

    def post(self, request):
        validar_perfil_esperado(request)
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        datos = _validar_datos(CrearPerfilInputSerializer, request.data)
        perfil = crear_perfil(actor, **datos)
        return Response(
            serializar_perfil_admin(actor, perfil),
            status=status.HTTP_201_CREATED,
        )


class PerfilAdminDetailAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    corte_permisos = '4.3'

    def get(self, request, pk):
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        return Response(obtener_perfil_admin(actor, pk))

    def patch(self, request, pk):
        validar_perfil_esperado(request)
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        try:
            perfil = Perfil.objects.get(pk=pk)
        except (Perfil.DoesNotExist, ValueError, TypeError):
            raise ErrorFuncional(
                status.HTTP_404_NOT_FOUND,
                'perfil_no_encontrado',
                'Perfil no encontrado.',
            )
        datos = _validar_datos(ModificarPerfilInputSerializer, request.data, partial=True)
        perfil_mod = modificar_perfil(actor, perfil=perfil, datos=datos)
        return Response(serializar_perfil_admin(actor, perfil_mod))

    def delete(self, request, pk):
        validar_perfil_esperado(request)
        actor = resolver_actor_http(request)
        if not es_actor_autorizado_administracion(actor):
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'permiso_insuficiente',
                'No tenes permiso para realizar esta accion.',
            )
        try:
            perfil = Perfil.objects.get(pk=pk)
        except (Perfil.DoesNotExist, ValueError, TypeError):
            raise ErrorFuncional(
                status.HTTP_404_NOT_FOUND,
                'perfil_no_encontrado',
                'Perfil no encontrado.',
            )
        eliminar_perfil(actor, perfil=perfil)
        return Response(status=status.HTTP_204_NO_CONTENT)
