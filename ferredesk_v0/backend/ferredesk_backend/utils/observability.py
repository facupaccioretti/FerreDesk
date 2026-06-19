import json
import logging
import time
import tracemalloc
from contextlib import contextmanager
from dataclasses import dataclass, field

from django.db import connection
from django_tenants.utils import get_public_schema_name


logger = logging.getLogger("ferredesk.observabilidad")


class _ContadorQueries:
    def __init__(self):
        self.total = 0

    def __call__(self, execute, sql, params, many, context):
        self.total += 1
        return execute(sql, params, many, context)


@dataclass
class MedicionObservabilidad:
    proceso: str
    schema_name: str
    datos: dict = field(default_factory=dict)

    def registrar_metricas(self, **metricas):
        for clave, valor in metricas.items():
            if valor is not None:
                self.datos[clave] = valor


def _normalizar_valor(valor):
    if isinstance(valor, (str, int, float, bool)) or valor is None:
        return valor
    if isinstance(valor, (list, tuple, set)):
        return [_normalizar_valor(item) for item in valor]
    if isinstance(valor, dict):
        return {str(k): _normalizar_valor(v) for k, v in valor.items()}
    return str(valor)


@contextmanager
def medir_proceso(proceso, schema_name=None, **datos_iniciales):
    schema = schema_name or getattr(connection, "schema_name", get_public_schema_name())
    medicion = MedicionObservabilidad(
        proceso=proceso,
        schema_name=schema,
        datos={k: _normalizar_valor(v) for k, v in datos_iniciales.items() if v is not None},
    )
    contador_queries = _ContadorQueries()

    tracing_previo = tracemalloc.is_tracing()
    if not tracing_previo:
        tracemalloc.start()

    memoria_inicio_actual, memoria_inicio_peak = tracemalloc.get_traced_memory()
    inicio = time.perf_counter()

    try:
        with connection.execute_wrapper(contador_queries):
            yield medicion
    except Exception as exc:
        medicion.registrar_metricas(
            estado="error",
            tipo_error=exc.__class__.__name__,
            error=str(exc),
        )
        raise
    else:
        medicion.registrar_metricas(estado="ok")
    finally:
        duracion_ms = round((time.perf_counter() - inicio) * 1000, 2)
        memoria_fin_actual, memoria_fin_peak = tracemalloc.get_traced_memory()

        payload = {
            "proceso": proceso,
            "schema": schema,
            "duracion_ms": duracion_ms,
            "queries": contador_queries.total,
            "memoria_actual_kb": max(0, memoria_fin_actual - memoria_inicio_actual) // 1024,
            "memoria_peak_kb": max(0, memoria_fin_peak - memoria_inicio_peak) // 1024,
        }
        payload.update({k: _normalizar_valor(v) for k, v in medicion.datos.items()})

        logger.info("OBSERVABILIDAD %s", json.dumps(payload, ensure_ascii=False, sort_keys=True))

        if not tracing_previo:
            tracemalloc.stop()
