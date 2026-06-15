"""
Servicio encargado de la gestion de copias de seguridad del sistema.
Provee funciones para ejecutar dumps de PostgreSQL de forma asincrona,
monitorear su estado y realizar la limpieza de archivos antiguos.
"""

import logging
import os
import subprocess
import tempfile
import threading
from datetime import datetime, timedelta

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connection

logger = logging.getLogger(__name__)

# Mantenemos el estado en memoria para que el frontend pueda consultar el progreso
# sin persistencia adicional para una tarea efimera.
ESTADO_BACKUP = {
    'estado': 'INACTIVO',   # INACTIVO, EN_CURSO, EXITO, ERROR
    'ultima_ejecucion': None,
    'error': None
}


def obtener_estado_backup():
    return ESTADO_BACKUP


def _obtener_schema_activo():
    """
    Resuelve el schema actual del tenant activo.
    """
    schema_name = getattr(connection, 'schema_name', None)
    return str(schema_name or 'public')


def _normalizar_schema_para_archivo(schema_name):
    """
    Genera un segmento seguro para usar en nombres de archivo.
    """
    schema_texto = str(schema_name or 'public').strip()
    return "".join(
        caracter if caracter.isalnum() or caracter in ('-', '_') else '_'
        for caracter in schema_texto
    ) or 'public'


def _construir_nombre_archivo_backup(schema_name, marca_tiempo, extension):
    """
    Construye el nombre del backup incluyendo el schema del tenant.
    """
    schema_seguro = _normalizar_schema_para_archivo(schema_name)
    return f"backup_{schema_seguro}_{marca_tiempo}.{extension}"


def _construir_ruta_storage_backup(schema_name, nombre_archivo):
    """
    Replica el esquema de particionado tenant-scoped usado en media: schema/backups/archivo.
    """
    schema_seguro = _normalizar_schema_para_archivo(_validar_schema_respaldo(schema_name))
    segmentos = [schema_seguro, "backups"]
    nombre_limpio = str(nombre_archivo).strip("/\\")
    if nombre_limpio:
        segmentos.append(nombre_limpio)
    return "/".join(segmentos)


def _construir_sentencia_pg_dump(comando_pg_dump, config_db, schema_name, ruta_archivo_tmp):
    """
    Arma el comando de pg_dump restringido al schema activo.
    """
    return [
        comando_pg_dump,
        "-h", str(config_db.get('HOST', 'localhost')),
        "-p", str(config_db.get('PORT', '5432')),
        "-U", str(config_db.get('USER', 'postgres')),
        "-F", "c",
        "-Z", "5",
        f"--schema={schema_name}",
        "-d", str(config_db.get('NAME', 'ferredesk')),
        "-f", ruta_archivo_tmp,
    ]


def _validar_schema_respaldo(schema_name):
    """
    Este servicio queda definido como backup operativo de tenants.
    Rechaza `public` para no mezclar backups de plataforma con flujos del ERP.
    """
    schema_respaldo = str(schema_name or '').strip() or 'public'
    if schema_respaldo == 'public':
        raise ValueError(
            "El backup operativo de tenants no permite respaldar el schema 'public'. "
            "Use un flujo especifico de plataforma para ese caso."
        )
    return schema_respaldo


def ejecutar_backup_asincrono():
    """
    Iniciamos el proceso en un hilo separado para que el usuario reciba
    la confirmacion del Cierre Z inmediatamente sin esperar al volcado SQL.
    """
    if ESTADO_BACKUP['estado'] == 'EN_CURSO':
        logger.warning("Intento de backup ignorado: Ya hay uno en curso.")
        return

    schema_name = _obtener_schema_activo()
    hilo = threading.Thread(target=_proceso_backup_interno, args=(schema_name,))
    hilo.daemon = True
    hilo.start()


def _obtener_ruta_pg_dump_windows():
    """
    Busca el ejecutable en rutas estandar de Windows para no depender del PATH.
    """
    ruta_personalizada = os.environ.get('PG_DUMP_PATH')
    if ruta_personalizada and os.path.exists(ruta_personalizada):
        return ruta_personalizada

    import shutil
    if shutil.which("pg_dump"):
        return "pg_dump.exe"

    archivos_programa = os.environ.get('ProgramW6432', 'C:\\Program Files')
    ruta_base_pg = os.path.join(archivos_programa, 'PostgreSQL')

    if os.path.exists(ruta_base_pg):
        for version in ['16', '15', '14', '13', '12', '11', '10']:
            ruta_posible = os.path.join(ruta_base_pg, version, 'bin', 'pg_dump.exe')
            if os.path.exists(ruta_posible):
                return ruta_posible

    return "pg_dump.exe"


def _proceso_backup_interno(schema_name=None):
    global ESTADO_BACKUP
    ESTADO_BACKUP['estado'] = 'EN_CURSO'
    ESTADO_BACKUP['error'] = None

    try:
        schema_respaldo = _validar_schema_respaldo(schema_name or _obtener_schema_activo())
        es_windows = os.name == 'nt'
        comando_pg_dump = _obtener_ruta_pg_dump_windows() if es_windows else "pg_dump"

        marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo_tmp = _construir_nombre_archivo_backup(schema_respaldo, marca_tiempo, "tmp")
        nombre_archivo_dump = _construir_nombre_archivo_backup(schema_respaldo, marca_tiempo, "dump")
        nombre_archivo_error = _construir_nombre_archivo_backup(schema_respaldo, marca_tiempo, "err")
        ruta_storage_dump = _construir_ruta_storage_backup(schema_respaldo, nombre_archivo_dump)
        ruta_storage_error = _construir_ruta_storage_backup(schema_respaldo, nombre_archivo_error)

        config_db = settings.DATABASES['default']
        entorno = os.environ.copy()
        entorno['PGPASSWORD'] = str(config_db.get('PASSWORD', ''))

        with tempfile.TemporaryDirectory(prefix="ferredesk_backup_") as directorio_temporal:
            ruta_archivo_tmp = os.path.join(directorio_temporal, nombre_archivo_tmp)
            sentencia = _construir_sentencia_pg_dump(
                comando_pg_dump=comando_pg_dump,
                config_db=config_db,
                schema_name=schema_respaldo,
                ruta_archivo_tmp=ruta_archivo_tmp,
            )

            logger.info(
                "Iniciando backup del schema '%s' hacia storage '%s'",
                schema_respaldo,
                ruta_storage_dump,
            )

            resultado = subprocess.run(sentencia, env=entorno, capture_output=True, text=True, check=False)

            if resultado.returncode == 0:
                with open(ruta_archivo_tmp, 'rb') as archivo_tmp:
                    default_storage.save(ruta_storage_dump, File(archivo_tmp, name=nombre_archivo_dump))

                ESTADO_BACKUP['estado'] = 'EXITO'
                ESTADO_BACKUP['ultima_ejecucion'] = datetime.now().isoformat()
                logger.info("Backup finalizado exitosamente en storage: %s", ruta_storage_dump)
            else:
                if os.path.exists(ruta_archivo_tmp):
                    with open(ruta_archivo_tmp, 'rb') as archivo_tmp:
                        default_storage.save(ruta_storage_error, File(archivo_tmp, name=nombre_archivo_error))
                elif resultado.stderr:
                    default_storage.save(
                        ruta_storage_error,
                        ContentFile(resultado.stderr.encode('utf-8'), name=nombre_archivo_error),
                    )

                ESTADO_BACKUP['estado'] = 'ERROR'
                ESTADO_BACKUP['error'] = resultado.stderr
                logger.error("Fallo en pg_dump. Error: %s", resultado.stderr)

            _limpiar_backups_antiguos(schema_respaldo, dias_retencion=60)

    except ValueError as e:
        ESTADO_BACKUP['estado'] = 'ERROR'
        ESTADO_BACKUP['error'] = str(e)
        logger.warning(str(e))
    except FileNotFoundError:
        ESTADO_BACKUP['estado'] = 'ERROR'
        ESTADO_BACKUP['error'] = 'El comando pg_dump no se encuentra instalado en el servidor.'
        logger.error("pg_dump no encontrado. Verificar instalacion de postgresql-client.")
    except Exception as e:
        ESTADO_BACKUP['estado'] = 'ERROR'
        ESTADO_BACKUP['error'] = str(e)
        logger.exception("Error critico no controlado durante el backup: %s", str(e))


def _limpiar_backups_antiguos(schema_name, dias_retencion=60):
    """
    Evita el crecimiento indefinido del storage eliminando backups antiguos del tenant.
    """
    try:
        ahora = datetime.now()
        limite = ahora - timedelta(days=dias_retencion)
        directorio_storage = _construir_ruta_storage_backup(schema_name, "")
        _, archivos = default_storage.listdir(directorio_storage)

        for archivo in archivos:
            if not (archivo.endswith(".dump") or archivo.endswith(".err")):
                continue

            ruta_archivo = f"{directorio_storage.rstrip('/')}/{archivo}"
            momento_modificacion = default_storage.get_modified_time(ruta_archivo)
            if getattr(momento_modificacion, "tzinfo", None) is not None:
                momento_modificacion = momento_modificacion.replace(tzinfo=None)

            if momento_modificacion < limite:
                default_storage.delete(ruta_archivo)
                logger.info("Limpieza: Backup antiguo eliminado de storage: %s", ruta_archivo)
    except Exception:
        pass
