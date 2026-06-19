from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.productos.models import ImportacionListaPreciosProveedor
from ferreapps.productos.services.importacion_lista_precios_service import (
    procesar_importacion_pendiente_lista_precios,
)
from tenants.models import EmpresaTenant


class Command(BaseCommand):
    help = "Procesa importaciones pendientes de listas de precios por tenant/schema."

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
            help="Cantidad maxima de importaciones pendientes a procesar por tenant.",
        )

    def handle(self, *args, **options):
        schema_name = options["schema_name"]
        limit = max(options["limit"], 0)

        if schema_name == get_public_schema_name():
            raise CommandError("El schema 'public' no procesa importaciones de tenants.")

        if schema_name:
            tenants = self._obtener_tenants_por_schema(schema_name)
        else:
            tenants = self._obtener_tenants_activos()

        procesadas = 0
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                queryset = ImportacionListaPreciosProveedor.objects.filter(
                    estado=ImportacionListaPreciosProveedor.ESTADO_PENDIENTE
                ).order_by("creado_en")
                if limit:
                    queryset = queryset[:limit]

                pendientes = list(queryset.values_list("id", flat=True))
                self.stdout.write(
                    f"schema={tenant.schema_name} pendientes={len(pendientes)}"
                )

                for importacion_id in pendientes:
                    importacion = procesar_importacion_pendiente_lista_precios(
                        importacion_id
                    )
                    procesadas += 1
                    self.stdout.write(
                        (
                            f"schema={tenant.schema_name} importacion_id={importacion.id} "
                            f"estado={importacion.estado} "
                            f"procesados={importacion.registros_procesados} "
                            f"actualizados={importacion.registros_actualizados}"
                        )
                    )

        self.stdout.write(self.style.SUCCESS(f"Importaciones procesadas: {procesadas}"))

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
