from dataclasses import InitVar, dataclass
from typing import Any

from django.core.exceptions import ImproperlyConfigured
from django.db import connection

from ferreapps.usuarios.models import ActorTipo, Perfil
from ferreapps.usuarios.selectors.adopcion import perfiles_adoptados
from ferreapps.usuarios.validators import validar_combinacion_actor


@dataclass(frozen=True, slots=True)
class ActorContext:
    tipo: str
    usuario: Any
    perfil: Any
    etiqueta: str
    exigir_cuenta_humana: InitVar[bool] = True

    def __post_init__(self, exigir_cuenta_humana):
        validar_combinacion_actor(
            tipo=self.tipo,
            usuario=self.usuario,
            perfil=self.perfil,
            etiqueta=self.etiqueta,
            exigir_cuenta_humana=exigir_cuenta_humana,
        )

    def campos(self, *, incluir_usuario=True):
        campos = {
            'actor_tipo': self.tipo,
            'actor_perfil': self.perfil,
            'actor_etiqueta': self.etiqueta,
        }
        if incluir_usuario:
            campos['actor_usuario'] = self.usuario
        return campos


def _perfiles_adoptados(request):
    return perfiles_adoptados(request)


def resolver_actor(request):
    contexto = getattr(request, '_actor_context', None)
    if contexto is not None:
        return contexto
    if not connection.in_atomic_block:
        raise ImproperlyConfigured('El actor debe resolverse dentro de transaction.atomic().')

    usuario = getattr(request, 'user', None)
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        raise ImproperlyConfigured('No hay una cuenta autenticada para resolver el actor.')

    perfil = getattr(request, 'perfil_operativo', None)
    if perfil is None:
        if _perfiles_adoptados(request):
            raise ImproperlyConfigured(
                'Un tenant con perfiles adoptados requiere un perfil operativo.'
            )
        contexto = ActorContext(
            tipo=ActorTipo.TITULAR,
            usuario=usuario,
            perfil=None,
            etiqueta='Titular',
        )
    else:
        contexto = ActorContext(
            tipo=ActorTipo.PERFIL,
            usuario=usuario,
            perfil=perfil,
            etiqueta=perfil.etiqueta,
        )
    request._actor_context = contexto
    return contexto


def resolver_actor_http(request):
    contexto = getattr(request, '_actor_context_http', None)
    if contexto is not None:
        return contexto

    usuario = getattr(request, 'user', None)
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        return None

    perfil = getattr(request, 'perfil_operativo', None)
    if perfil is not None:
        contexto = ActorContext(
            tipo=ActorTipo.PERFIL,
            usuario=usuario,
            perfil=perfil,
            etiqueta=perfil.etiqueta,
        )
    else:
        if _perfiles_adoptados(request):
            return None
        contexto = ActorContext(
            tipo=ActorTipo.TITULAR,
            usuario=usuario,
            perfil=None,
            etiqueta='Titular',
        )

    request._actor_context_http = contexto
    return contexto


def crear_actor_sistema(*, etiqueta='Sistema'):
    return ActorContext(
        tipo=ActorTipo.SISTEMA,
        usuario=None,
        perfil=None,
        etiqueta=etiqueta,
    )


def actor_desde_raiz(raiz):
    usuario = getattr(raiz, 'actor_usuario', None)
    if usuario is None:
        for campo in ('usuario', 'rec_usuario', 'op_usuario', 'aj_usuario', 'usuario_registro'):
            usuario = getattr(raiz, campo, None)
            if usuario is not None:
                break
    return ActorContext(
        tipo=raiz.actor_tipo,
        usuario=usuario,
        perfil=raiz.actor_perfil,
        etiqueta=raiz.actor_etiqueta,
        # Snapshot persistido: la cuenta puede ser nula en historia no reconstruible.
        exigir_cuenta_humana=False,
    )
