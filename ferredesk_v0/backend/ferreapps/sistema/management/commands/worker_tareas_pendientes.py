import signal
import sys
import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.productos.models import ImportacionListaPreciosProveedor
from ferreapps.productos.services.importacion_lista_precios_service import (
    procesar_importacion_pendiente_lista_precios,
)
from ferreapps.proveedores.models import SolicitudCargaInicialProveedor
from ferreapps.proveedores.services.carga_inicial_proveedor_service import (
    procesar_solicitud_carga_inicial,
)
from tenants.models import EmpresaTenant


class Command(BaseCommand):
    help = "Worker continuo para procesar colas de tareas de manera eficiente."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.shutdown_flag = False

    def _handle_sigterm(self, signum, frame):
        self.stdout.write(
            self.style.WARNING(
                "Recibida señal de apagado. Terminando limpiamente al finalizar la tarea actual..."
            )
        )
        self.shutdown_flag = True

    def handle(self, *args, **options):
        # Capturamos SIGTERM y SIGINT
        signal.signal(signal.SIGTERM, self._handle_sigterm)
        signal.signal(signal.SIGINT, self._handle_sigterm)

        self.stdout.write(
            self.style.SUCCESS("Iniciando worker_tareas_pendientes continuo...")
        )

        while not self.shutdown_flag:
            try:
                # Cerramos conexiones viejas antes de cada ciclo
                close_old_connections()

                # Buscamos tareas estancadas y las marcamos como error
                self._recuperar_tareas_estancadas()

                procesadas_en_ciclo = 0

                tenants = self._obtener_tenants_activos()
                for tenant in tenants:
                    if self.shutdown_flag:
                        break

                    with schema_context(tenant.schema_name):
                        # --- Procesar Cargas Iniciales (Limite 5) ---
                        pendientes_cargas = list(
                            SolicitudCargaInicialProveedor.objects.filter(
                                estado=SolicitudCargaInicialProveedor.ESTADO_PENDIENTE
                            ).values_list("id", flat=True)[:5]
                        )
                        for sol_id in pendientes_cargas:
                            if self.shutdown_flag:
                                break
                            solicitud = procesar_solicitud_carga_inicial(sol_id)
                            self.stdout.write(
                                f"schema={tenant.schema_name} carga_inicial={solicitud.id} estado={solicitud.estado}"
                            )
                            procesadas_en_ciclo += 1

                        # --- Procesar Listas de Precios (Limite 5) ---
                        pendientes_listas = list(
                            ImportacionListaPreciosProveedor.objects.filter(
                                estado=ImportacionListaPreciosProveedor.ESTADO_PENDIENTE
                            ).values_list("id", flat=True)[:5]
                        )
                        for imp_id in pendientes_listas:
                            if self.shutdown_flag:
                                break
                            importacion = procesar_importacion_pendiente_lista_precios(imp_id)
                            self.stdout.write(
                                f"schema={tenant.schema_name} lista_precios={importacion.id} estado={importacion.estado}"
                            )
                            procesadas_en_ciclo += 1

                # Si no hubo nada que hacer, dormimos un poco
                if procesadas_en_ciclo == 0 and not self.shutdown_flag:
                    time.sleep(5)

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"Error inesperado en worker_tareas_pendientes: {exc}")
                )
                # Dormimos un momento si hay error para no saturar si ocurre constantemente
                time.sleep(5)

        self.stdout.write(self.style.SUCCESS("Worker apagado correctamente."))
        sys.exit(0)

    def _recuperar_tareas_estancadas(self):
        """Busca tareas en ESTADO_PROCESANDO de hace mas de 1 hora y las marca como ERROR."""
        hace_una_hora = timezone.now() - timedelta(hours=1)

        tenants = self._obtener_tenants_activos()
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                # Recuperar Cargas Iniciales
                cargas_trabadas = SolicitudCargaInicialProveedor.objects.filter(
                    estado=SolicitudCargaInicialProveedor.ESTADO_PROCESANDO,
                    iniciado_en__lt=hace_una_hora,
                )
                if cargas_trabadas.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f"schema={tenant.schema_name} recuperando {cargas_trabadas.count()} cargas iniciales trabadas"
                        )
                    )
                    cargas_trabadas.update(
                        estado=SolicitudCargaInicialProveedor.ESTADO_ERROR,
                        mensaje_error="El proceso fue interrumpido inesperadamente y tardó demasiado. Marcado como error por timeout del worker.",
                        actualizado_en=timezone.now(),
                    )

                # Recuperar Listas de Precios
                listas_trabadas = ImportacionListaPreciosProveedor.objects.filter(
                    estado=ImportacionListaPreciosProveedor.ESTADO_PROCESANDO,
                    iniciado_en__lt=hace_una_hora,
                )
                if listas_trabadas.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f"schema={tenant.schema_name} recuperando {listas_trabadas.count()} listas de precios trabadas"
                        )
                    )
                    listas_trabadas.update(
                        estado=ImportacionListaPreciosProveedor.ESTADO_ERROR,
                        mensaje_error="El proceso fue interrumpido inesperadamente y tardó demasiado. Marcado como error por timeout del worker.",
                        actualizado_en=timezone.now(),
                    )

    def _obtener_tenants_activos(self):
        with schema_context(get_public_schema_name()):
            return list(
                EmpresaTenant.objects.exclude(schema_name=get_public_schema_name())
                .filter(activo=True)
                .order_by("schema_name")
            )
