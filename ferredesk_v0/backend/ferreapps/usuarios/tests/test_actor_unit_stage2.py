from types import SimpleNamespace

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from ferreapps.usuarios.services.actor_service import ActorContext, actor_desde_raiz
from ferreapps.usuarios.validators import validar_combinacion_actor


class ValidarCombinacionActorTests(SimpleTestCase):
    def _validar(self, **kwargs):
        base = dict(
            tipo=ActorTipo.TITULAR,
            usuario=Usuario(username="dummy"),
            perfil=None,
            etiqueta="Titular",
        )
        base.update(kwargs)
        return validar_combinacion_actor(**base)

    def test_combinacion_valida(self):
        self._validar()

    def test_tipo_invalido(self):
        with self.assertRaises(ValidationError):
            self._validar(tipo='INVALIDO')

    def test_etiqueta_vacia_o_solo_espacios(self):
        for etiqueta in ('', '   '):
            with self.assertRaises(ValidationError):
                self._validar(etiqueta=etiqueta)

    def test_perfil_requiere_perfil(self):
        with self.assertRaises(ValidationError):
            self._validar(tipo=ActorTipo.PERFIL, perfil=None)

    def test_titular_y_sistema_no_admiten_perfil(self):
        for tipo in (ActorTipo.TITULAR, ActorTipo.SISTEMA):
            with self.assertRaises(ValidationError):
                self._validar(tipo=tipo, perfil=Perfil(nombre="Invalido"))

    def test_titular_sin_cuenta_segun_exigencia(self):
        with self.assertRaises(ValidationError):
            self._validar(usuario=None)
        self._validar(usuario=None, exigir_cuenta_humana=False)


class ActorDesdeRaizHistoricaTests(SimpleTestCase):
    def test_raiz_historica_sin_cuenta_no_falla(self):
        raiz = SimpleNamespace(
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=None,
            actor_perfil=None,
            actor_etiqueta='Titular',
        )
        actor = actor_desde_raiz(raiz)
        self.assertIsNone(actor.usuario)
        self.assertEqual(actor.tipo, ActorTipo.TITULAR)

    def test_contexto_directo_sigue_exigiendo_cuenta(self):
        with self.assertRaises(ValidationError):
            ActorContext(tipo=ActorTipo.TITULAR, usuario=None, perfil=None, etiqueta='Titular')
