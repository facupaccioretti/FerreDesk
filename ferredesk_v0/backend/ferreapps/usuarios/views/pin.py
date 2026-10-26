from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ferreapps.usuarios.serializers import (
    CambiarPinPropioInputSerializer,
    ConfirmarRecuperacionPinInputSerializer,
    RestablecerPinInputSerializer,
)
from ferreapps.usuarios.services.pin import (
    cambiar_pin_propio,
    restablecer_pin_ordinario,
    validar_dueno_identificado,
)
from ferreapps.usuarios.services.recuperacion_pin import (
    confirmar_recuperacion_pin_dueno,
    solicitar_recuperacion_pin_dueno,
)
from ferreapps.usuarios.validators.acceso_http import validar_perfil_esperado
from ferredesk_backend.utils.exceptions import ErrorFuncional


def _validar_entrada(serializer_cls, data):
    serializer = serializer_cls(data=data)
    if serializer.is_valid():
        return serializer.validated_data
    raise ErrorFuncional(
        status.HTTP_400_BAD_REQUEST,
        'payload_invalido',
        'Los datos enviados no son validos.',
        fields=serializer.errors,
    )


class CambiarPinPropioAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'perfil_activo'
    corte_permisos = '4.4'

    def post(self, request):
        validar_perfil_esperado(request)
        datos = _validar_entrada(CambiarPinPropioInputSerializer, request.data)
        cambiar_pin_propio(
            request=request,
            pin_actual=datos['pin_actual'],
            pin_nuevo=datos['pin_nuevo'],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class RestablecerPinOrdinarioAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'requiere_dueno'
    corte_permisos = '4.4'

    def post(self, request, pk):
        validar_perfil_esperado(request)
        validar_dueno_identificado(request)
        datos = _validar_entrada(RestablecerPinInputSerializer, request.data)
        restablecer_pin_ordinario(
            request=request,
            perfil_id=pk,
            pin_nuevo=datos['pin_nuevo'],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SolicitarRecuperacionPinDuenoAPIView(APIView):
    permission_classes = (IsAuthenticated,)
    exencion_permiso = 'sesion_exenta'
    corte_permisos = '4.4'

    def post(self, request):
        solicitar_recuperacion_pin_dueno(request=request)
        return Response({}, status=status.HTTP_202_ACCEPTED)


class ConfirmarRecuperacionPinDuenoAPIView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    exencion_permiso = 'publica'
    corte_permisos = '4.4'

    def post(self, request):
        datos = _validar_entrada(ConfirmarRecuperacionPinInputSerializer, request.data)
        confirmar_recuperacion_pin_dueno(
            token=datos['token'],
            pin_nuevo=datos['pin_nuevo'],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
