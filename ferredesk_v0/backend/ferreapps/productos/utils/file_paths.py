import os

from ferredesk_backend.utils.storage import (
    normalizar_nombre_archivo,
    obtener_schema_tenant,
    tenant_upload_path,
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
    _, extension = os.path.splitext(nombre_archivo)
    extension = extension.lower() if extension else ".jpg"
    if extension not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        extension = ".jpg"
    return f"{directorio}/logo{extension}"


def upload_certificado_arca(instance, filename) -> str:
    schema_name = obtener_schema_name_para_archivos()
    return f"arca/{schema_name}/certificados/certificado.pem"


def upload_clave_privada_arca(instance, filename) -> str:
    schema_name = obtener_schema_name_para_archivos()
    return f"arca/{schema_name}/claves_privadas/clave_privada.pem"


upload_importacion_lista_precios_temporal = tenant_upload_path(
    "importaciones_listas_precios"
)


upload_carga_inicial_proveedor_temporal = tenant_upload_path(
    "cargas_iniciales_proveedor"
)


def obtener_directorio_arca_relativo() -> str:
    schema_name = obtener_schema_name_para_archivos()
    return f"arca/{schema_name}"


def obtener_directorio_arca_absoluto(media_root: str) -> str:
    directorio_relativo = obtener_directorio_arca_relativo()
    return os.path.join(media_root, *directorio_relativo.split("/"))


def obtener_directorio_arca_por_schema_absoluto(base_dir_arca: str) -> str:
    schema_name = obtener_schema_name_para_archivos()
    return os.path.join(base_dir_arca, schema_name)
