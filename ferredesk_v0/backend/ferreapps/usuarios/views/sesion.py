from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ferreapps.usuarios.selectors.perfiles import (
    seleccionar_opciones_actor,
    seleccionar_perfiles_habilitados,
)
from ferreapps.usuarios.serializers import (
    ActivarPerfilesInputSerializer,
    ActorOpcionSerializer,
    IdentificarPerfilInputSerializer,
    PerfilResumenSerializer,
    PerfilSeleccionSerializer,
)
from ferreapps.usuarios.services.identidad import (
    activar_perfiles,
    bloquear_perfil,
    cambiar_perfil,
    identificar_perfil,
    registrar_heartbeat,
    validar_activacion_disponible,
)
from ferredesk_backend.permissions import RequierePermisoFuncional
from ferredesk_backend.utils.exceptions import ErrorFuncional


def _validar_entrada(serializer):
    if serializer.is_valid():
        return serializer.validated_data
    raise ErrorFuncional(
        status.HTTP_400_BAD_REQUEST,
        'payload_invalido',
        'Los datos enviados no son validos.',
        fields=serializer.errors,
    )


class ActivarPerfilesAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'sesion_exenta'
    corte_permisos = '4.2'

    def post(self, request):
        validar_activacion_disponible()
        datos = _validar_entrada(ActivarPerfilesInputSerializer(data=request.data))
        perfil = activar_perfiles(request=request, **{
            clave: datos[clave] for clave in ('nombre', 'pin', 'contrasena')
        })
        return Response(
            {'perfil_activo': PerfilResumenSerializer(perfil).data},
            status=status.HTTP_201_CREATED,
        )


class SeleccionPerfilesAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'sesion_exenta'
    corte_permisos = '4.2'

    def get(self, request):
        perfiles = [
            {
                'id': perfil.pk,
                'nombre': perfil.nombre,
                'etiqueta': perfil.etiqueta,
                'tipo': perfil.tipo,
                'es_dueno': perfil.tipo == perfil.TIPO_DUENO,
                'espera_hasta': espera_hasta,
            }
            for perfil, espera_hasta in seleccionar_perfiles_habilitados(request)
        ]
        return Response(PerfilSeleccionSerializer(perfiles, many=True).data)


class IdentificarPerfilAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'sesion_exenta'
    corte_permisos = '4.2'

    def post(self, request):
        datos = _validar_entrada(IdentificarPerfilInputSerializer(data=request.data))
        perfil = identificar_perfil(request=request, **datos)
        return Response({'perfil_activo': PerfilResumenSerializer(perfil).data})


class CambiarPerfilAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    perfil_esperado_exento = True
    corte_permisos = '4.2'

    def post(self, request):
        datos = _validar_entrada(IdentificarPerfilInputSerializer(data=request.data))
        perfil = cambiar_perfil(request=request, **datos)
        return Response({'perfil_activo': PerfilResumenSerializer(perfil).data})


class BloquearPerfilAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'sesion_exenta'
    corte_permisos = '4.2'

    def post(self, request):
        bloquear_perfil(request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActividadPerfilAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    corte_permisos = '4.2'

    def post(self, request):
        registrar_heartbeat(request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OpcionesActorAPIView(APIView):
    permission_classes = (IsAuthenticated, RequierePermisoFuncional)
    permiso_requerido = 'ventas.ver'
    corte_permisos = '4.2'

    def get(self, request):
        return Response(ActorOpcionSerializer(seleccionar_opciones_actor(), many=True).data)

