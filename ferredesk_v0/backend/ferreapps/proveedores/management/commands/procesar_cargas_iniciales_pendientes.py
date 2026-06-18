from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.proveedores.models import SolicitudCargaInicialProveedor
from ferreapps.proveedores.services.carga_inicial_proveedor_service import (
    procesar_solicitud_carga_inicial,
)
from tenants.models import EmpresaTenant


class Command(BaseCommand):
    help = "Procesa cargas iniciales pendientes de proveedor por tenant/schema."

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            dest="schema_name",
            help="Schema tenant a procesar. Si se omite, procesa todos los tenants activos.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Cantidad maxima de solicitudes pendientes a procesar por tenant.",
        )

    def handle(self, *args, **options):
        schema_name = options["schema_name"]
        limit = max(options["limit"], 0)

        if schema_name == get_public_schema_name():
            raise CommandError("El schema 'public' no procesa cargas iniciales de tenants.")

        tenants = (
            self._obtener_tenants_por_schema(schema_name)
            if schema_name
            else self._obtener_tenants_activos()
        )

        procesadas = 0
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                queryset = SolicitudCargaInicialProveedor.objects.filter(
                    estado=SolicitudCargaInicialProveedor.ESTADO_PENDIENTE
                ).order_by("creado_en")
                if limit:
                    queryset = queryset[:limit]

                pendientes = list(queryset.values_list("id", flat=True))
                self.stdout.write(
                    f"schema={tenant.schema_name} pendientes={len(pendientes)}"
                )

                for solicitud_id in pendientes:
                    solicitud = procesar_solicitud_carga_inicial(solicitud_id)
                    procesadas += 1
                    self.stdout.write(
                        (
                            f"schema={tenant.schema_name} solicitud_id={solicitud.id} "
                            f"estado={solicitud.estado} "
                            f"procesados={solicitud.registros_procesados} "
                            f"creados={solicitud.registros_creados} "
                            f"saltados={solicitud.registros_saltados}"
                        )
                    )

        self.stdout.write(self.style.SUCCESS(f"Cargas iniciales procesadas: {procesadas}"))

    def _obtener_tenants_activos(self):
        with schema_context(get_public_schema_name()):
            return list(
                EmpresaTenant.objects.exclude(
                    schema_name=get_public_schema_name()
                ).filter(activo=True).order_by("schema_name")
            )

    def _obtener_tenants_por_schema(self, schema_name):
        with schema_context(get_public_schema_name()):
            tenant = EmpresaTenant.objects.filter(schema_name=schema_name).first()

        if tenant is None:
            raise CommandError(f"No existe un tenant con schema '{schema_name}'.")

        return [tenant]
