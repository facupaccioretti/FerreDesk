import os

from django.db import connection


SCHEMA_PUBLICO = "public"


def obtener_schema_tenant(instance=None, permitir_publico=False) -> str:
    """
    Resuelve el schema tenant activo para archivos tenant-scoped.

    Si la operación ocurre fuera de un contexto tenant, falla en lugar de
    guardar silenciosamente dentro de ``public``.
    """
    candidatos = []

    if instance is not None:
        candidatos.extend(
            [
                getattr(instance, "schema_name", None),
                getattr(instance, "_schema_name", None),
            ]
        )

        relacion_ferreteria = getattr(instance, "ferreteria", None)
        if relacion_ferreteria is not None:
            candidatos.extend(
                [
                    getattr(relacion_ferreteria, "schema_name", None),
                    getattr(relacion_ferreteria, "_schema_name", None),
                ]
            )

    candidatos.append(getattr(connection, "schema_name", None))

    for candidato in candidatos:
        schema_name = os.path.basename(str(candidato).strip()) if candidato else ""
        if schema_name:
            if schema_name == SCHEMA_PUBLICO and not permitir_publico:
                raise ValueError(
                    "No se puede guardar un archivo aislado por tenant con el schema 'public' activo."
                )
            return schema_name

    if permitir_publico:
        return SCHEMA_PUBLICO

    raise ValueError("No se pudo resolver el schema tenant activo para el archivo.")


def normalizar_nombre_archivo(filename: str) -> str:
    nombre_archivo = os.path.basename(str(filename).strip())
    return nombre_archivo or "archivo"


def construir_ruta_tenant(*segmentos, instance=None, permitir_publico=False) -> str:
    schema_name = obtener_schema_tenant(
        instance=instance,
        permitir_publico=permitir_publico,
    )
    segmentos_limpios = [schema_name]
    segmentos_limpios.extend(str(segmento).strip("/\\") for segmento in segmentos if segmento)
    return "/".join(segmentos_limpios)


def tenant_upload_path(subcarpeta: str, permitir_publico=False):
    subcarpeta_normalizada = str(subcarpeta).strip("/\\")

    def upload_to(instance, filename) -> str:
        nombre_archivo = normalizar_nombre_archivo(filename)
        return construir_ruta_tenant(
            subcarpeta_normalizada,
            nombre_archivo,
            instance=instance,
            permitir_publico=permitir_publico,
        )

    return upload_to
