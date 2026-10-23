from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max, Sum

from ferreapps.clientes.models import Vendedor
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from ferreapps.ventas.models import Venta
from ferreapps.ventas.serializers import VentaCalculadaSerializer, VentaSerializer
from ferreapps.ventas.tests import VentasTenantTestCase
from ferreapps.ventas.views.views_ventas import VentaCalculadaFilter, VentaFilter


class VentaActorStage2Tests(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.get(username="admin@ventas.test")
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo="DUENO",
            nombre="Lautaro",
            pin_hash="hash-no-real",
        )
        self.ordinario = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Maria",
            pin_hash="hash-no-real",
        )

    def _venta(self, numero, total, **actor):
        actor_defaults = {
            "actor_tipo": ActorTipo.TITULAR,
            "actor_usuario": self.usuario,
            "actor_perfil": None,
            "actor_etiqueta": "Titular",
            **actor,
        }
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date(2026, 10, 22),
            comprobante=self.comprobante_presupuesto,
            ven_punto=1,
            ven_numero=numero,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            ven_bonificacion_general=0,
            total_guardado=Decimal(total),
            **actor_defaults,
        )

    def test_base_acepta_las_tres_combinaciones_validas(self):
        titular = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_perfil=None,
            actor_etiqueta="Titular",
        )
        perfil = self._venta(
            2,
            "20.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria",
        )
        sistema = self._venta(
            3,
            "30.00",
            actor_tipo=ActorTipo.SISTEMA,
            actor_usuario=None,
            actor_perfil=None,
            actor_etiqueta="Sistema",
        )

        self.assertEqual(titular.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(perfil.actor_perfil, self.ordinario)
        self.assertIsNone(sistema.actor_usuario_id)

    def test_base_rechaza_combinaciones_invalidas(self):
        venta = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_perfil=None,
            actor_etiqueta="Titular",
        )
        casos = (
            {
                "actor_tipo": ActorTipo.PERFIL,
                "actor_perfil": None,
            },
            {
                "actor_tipo": ActorTipo.TITULAR,
                "actor_perfil": self.ordinario,
            },
            {
                "actor_tipo": ActorTipo.SISTEMA,
                "actor_perfil": self.ordinario,
            },
        )

        for cambios in casos:
            with self.subTest(cambios=cambios):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        Venta.objects.filter(pk=venta.pk).update(**cambios)

    def test_serializer_expone_snapshot_y_no_acepta_actor_del_payload(self):
        venta = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria historica",
        )
        serializer = VentaSerializer(
            venta,
            data={
                "ven_observacion": "Cambio permitido",
                "actor": {
                    "tipo": ActorTipo.SISTEMA,
                    "perfil_id": None,
                    "etiqueta": "Inyectado",
                },
                "actor_tipo": ActorTipo.SISTEMA,
                "actor_perfil": None,
                "actor_usuario": None,
                "actor_etiqueta": "Inyectado",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(
            {
                "actor",
                "actor_tipo",
                "actor_perfil",
                "actor_usuario",
                "actor_etiqueta",
            }.isdisjoint(serializer.validated_data)
        )
        serializer.save()
        venta.refresh_from_db()
        self.assertEqual(
            VentaSerializer(venta).data["actor"],
            {
                "tipo": ActorTipo.PERFIL,
                "perfil_id": self.ordinario.pk,
                "etiqueta": "Maria historica",
            },
        )
        self.assertEqual(venta.actor_tipo, ActorTipo.PERFIL)
        self.assertEqual(venta.actor_etiqueta, "Maria historica")

    def test_serializer_de_listado_usa_el_snapshot_persistido(self):
        venta = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Nombre al vender",
        )
        calculada = Venta.objects.con_calculos().get(pk=venta.pk)

        actor = VentaCalculadaSerializer(calculada).data["actor"]

        self.assertEqual(actor["etiqueta"], "Nombre al vender")
        self.assertEqual(actor["perfil_id"], self.ordinario.pk)

    def test_renombrar_perfil_no_reescribe_snapshot(self):
        venta = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria antes",
        )

        self.ordinario.nombre = "Maria despues"
        self.ordinario.save(update_fields=["nombre"])
        venta.refresh_from_db()

        self.assertEqual(venta.actor_etiqueta, "Maria antes")

    def test_filtros_actor_dueno_y_totales_particionan_el_negocio(self):
        titular = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_perfil=None,
            actor_etiqueta="Titular",
        )
        del_dueno = self._venta(
            2,
            "20.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.dueno,
            actor_etiqueta="Dueno (Lautaro)",
        )
        ordinaria = self._venta(
            3,
            "30.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria",
        )
        sistema = self._venta(
            4,
            "40.00",
            actor_tipo=ActorTipo.SISTEMA,
            actor_usuario=None,
            actor_perfil=None,
            actor_etiqueta="Sistema",
        )
        queryset = Venta.objects.filter(pk__in=[titular.pk, del_dueno.pk, ordinaria.pk, sistema.pk])

        filtro_dueno = VentaFilter(
            {"actor_perfil_id": self.dueno.pk},
            queryset=queryset,
        ).qs
        filtro_dueno_perfil = VentaFilter(
            {
                "actor_perfil_id": self.dueno.pk,
                "actor_tipo": ActorTipo.PERFIL,
            },
            queryset=queryset,
        ).qs
        filtro_ordinario = VentaCalculadaFilter(
            {"actor_perfil_id": self.ordinario.pk},
            queryset=queryset,
        ).qs
        filtro_sistema = VentaFilter(
            {"actor_tipo": ActorTipo.SISTEMA},
            queryset=queryset,
        ).qs

        self.assertSetEqual(set(filtro_dueno.values_list("pk", flat=True)), {titular.pk, del_dueno.pk})
        self.assertSetEqual(set(filtro_dueno_perfil.values_list("pk", flat=True)), {del_dueno.pk})
        self.assertSetEqual(set(filtro_ordinario.values_list("pk", flat=True)), {ordinaria.pk})
        self.assertSetEqual(set(filtro_sistema.values_list("pk", flat=True)), {sistema.pk})
        total_negocio = queryset.aggregate(total=Sum("total_guardado"))["total"]
        total_por_actor = sum(
            grupo.aggregate(total=Sum("total_guardado"))["total"] or Decimal("0.00")
            for grupo in (filtro_dueno, filtro_ordinario, filtro_sistema)
        )
        self.assertEqual(total_por_actor, total_negocio)

    def test_vendedor_sigue_siendo_independiente_del_actor(self):
        otro_vendedor = Vendedor.objects.create(
            id=(Vendedor.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1,
            nombre="Vendedor dos",
            dni="87654321",
            comivta=0,
            liquivta="N",
            comicob=0,
            liquicob="N",
            activo="S",
        )
        venta = self._venta(
            1,
            "10.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria",
        )
        otra = self._venta(
            2,
            "20.00",
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=self.ordinario,
            actor_etiqueta="Maria",
        )
        otra.ven_idvdo = otro_vendedor
        otra.save(update_fields=["ven_idvdo"])

        por_actor = VentaFilter(
            {"actor_perfil_id": self.ordinario.pk},
            queryset=Venta.objects.filter(pk__in=[venta.pk, otra.pk]),
        ).qs
        por_vendedor = VentaFilter(
            {"ven_idvdo": otro_vendedor.pk},
            queryset=por_actor,
        ).qs

        self.assertSetEqual(set(por_actor.values_list("pk", flat=True)), {venta.pk, otra.pk})
        self.assertSetEqual(set(por_vendedor.values_list("pk", flat=True)), {otra.pk})
        self.assertEqual(otra.actor_perfil, self.ordinario)

