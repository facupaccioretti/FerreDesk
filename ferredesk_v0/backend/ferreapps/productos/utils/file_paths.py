import os

from ferredesk_backend.utils.storage import (
    normalizar_nombre_archivo,
    obtener_schema_tenant,
)


def obtener_schema_name_para_archivos() -> str:
    return obtener_schema_tenant()


def obtener_directorio_logo_empresa_relativo() -> str:
    schema_name = obtener_schema_name_para_archivos()
    return f"logos/{schema_name}"


def obtener_logo_empresa_relativo(extension: str) -> str:
    directorio = obtener_directorio_logo_empresa_relativo()
    return f"{directorio}/logo{extension}"


def obtener_directorio_logo_empresa_absoluto(media_root: str) -> str:
    directorio_relativo = obtener_directorio_logo_empresa_relativo()
    return os.path.join(media_root, *directorio_relativo.split("/"))


def upload_logo_empresa(instance, filename) -> str:
    directorio = obtener_directorio_logo_empresa_relativo()
    nombre_archivo = normalizar_nombre_archivo(filename)
    return f"{directorio}/{nombre_archivo}"


def upload_certificado_arca(instance, filename) -> str:
    schema_name = obtener_schema_name_para_archivos()
    nombre_archivo = normalizar_nombre_archivo(filename)
    return f"arca/{schema_name}/certificados/{nombre_archivo}"


def upload_clave_privada_arca(instance, filename) -> str:
    schema_name = obtener_schema_name_para_archivos()
    nombre_archivo = normalizar_nombre_archivo(filename)
    return f"arca/{schema_name}/claves_privadas/{nombre_archivo}"


def obtener_directorio_arca_relativo() -> str:
    schema_name = obtener_schema_name_para_archivos()
    return f"arca/{schema_name}"


def obtener_directorio_arca_absoluto(media_root: str) -> str:
    directorio_relativo = obtener_directorio_arca_relativo()
    return os.path.join(media_root, *directorio_relativo.split("/"))


def obtener_directorio_arca_por_schema_absoluto(base_dir_arca: str) -> str:
    schema_name = obtener_schema_name_para_archivos()
    return os.path.join(base_dir_arca, schema_name)
