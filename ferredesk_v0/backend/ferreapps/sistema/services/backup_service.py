"""
Servicio encargado de la gestión de copias de seguridad (backups) del sistema.
Provee funciones para ejecutar dumps de PostgreSQL de forma asíncrona,
monitorear su estado y realizar la limpieza de archivos antiguos.
"""

import os
import subprocess
import threading
import logging
from datetime import datetime, timedelta
from django.conf import settings

logger = logging.getLogger(__name__)

# Mantenemos el estado en memoria para que el frontend pueda consultar el progreso 
# sin necesidad de persistencia en base de datos para una tarea tan efímera.
ESTADO_BACKUP = {
    'estado': 'INACTIVO',   # INACTIVO, EN_CURSO, EXITO, ERROR
    'ultima_ejecucion': None,
    'error': None
}

def obtener_estado_backup():
    return ESTADO_BACKUP

def ejecutar_backup_asincrono():
    """
    Iniciamos el proceso en un hilo separado para que el usuario reciba 
    la confirmación del Cierre Z inmediatamente sin esperar al volcado SQL.
    """
    if ESTADO_BACKUP['estado'] == 'EN_CURSO':
        logger.warning("Intento de backup ignorado: Ya hay uno en curso.")
        return
        
    hilo = threading.Thread(target=_proceso_backup_interno)
    hilo.daemon = True 
    hilo.start()

def _obtener_ruta_pg_dump_windows():
    """
    Buscamos el ejecutable en rutas estándar de Windows para evitar que la 
    funcionalidad dependa de que el usuario haya configurado manualmente su PATH.
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

def _proceso_backup_interno():
    global ESTADO_BACKUP
    ESTADO_BACKUP['estado'] = 'EN_CURSO'
    ESTADO_BACKUP['error'] = None
    
    try:
        es_docker = os.environ.get('IN_DOCKER', 'False') == 'True'
        
        if es_docker or not os.name == 'nt':
            comando_pg_dump = "pg_dump"
            directorio_backup = "/app/backups" 
        else:
            comando_pg_dump = _obtener_ruta_pg_dump_windows()
            
            try:
                base_backups = os.path.join(settings.BASE_DIR, "backups_locales")
                os.makedirs(base_backups, exist_ok=True)
                directorio_backup = base_backups
            except PermissionError:
                # Fallback necesario para instalaciones en C:\Archivos de Programa sin privilegios.
                directorio_backup = os.path.join(os.environ.get('LOCALAPPDATA', 'C:\\Temp'), 'FerreDesk', 'backups')
                os.makedirs(directorio_backup, exist_ok=True)
            
        marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")
        ruta_archivo_tmp = os.path.join(directorio_backup, f"backup_{marca_tiempo}.tmp")
        ruta_archivo_dump = os.path.join(directorio_backup, f"backup_{marca_tiempo}.dump")
        
        config_db = settings.DATABASES['default']
        entorno = os.environ.copy()
        entorno['PGPASSWORD'] = str(config_db.get('PASSWORD', ''))
        
        sentencia = [
            comando_pg_dump,
            "-h", str(config_db.get('HOST', 'localhost')),
            "-p", str(config_db.get('PORT', '5432')),
            "-U", str(config_db.get('USER', 'postgres')),
            "-F", "c", 
            "-Z", "5", 
            "-d", str(config_db.get('NAME', 'ferredesk')),
            "-f", ruta_archivo_tmp
        ]
        
        logger.info(f"Iniciando volcado de base de datos en: {ruta_archivo_tmp}")
        
        resultado = subprocess.run(sentencia, env=entorno, capture_output=True, text=True, check=False)
        
        if resultado.returncode == 0:
            # El renombrado atómico garantiza que el archivo .dump sea siempre un backup íntegro.
            os.rename(ruta_archivo_tmp, ruta_archivo_dump)
            ESTADO_BACKUP['estado'] = 'EXITO'
            ESTADO_BACKUP['ultima_ejecucion'] = datetime.now().isoformat()
            logger.info(f"Backup finalizado exitosamente: {ruta_archivo_dump}")
        else:
            # Preservamos el archivo con otra extensión para facilitar el diagnóstico del fallo.
            archivo_error = os.path.join(directorio_backup, f"backup_{marca_tiempo}.err")
            if os.path.exists(ruta_archivo_tmp):
                os.rename(ruta_archivo_tmp, archivo_error)
            
            ESTADO_BACKUP['estado'] = 'ERROR'
            ESTADO_BACKUP['error'] = resultado.stderr
            logger.error(f"Fallo en pg_dump. Error: {resultado.stderr}")
            
        _limpiar_backups_antiguos(directorio_backup, dias_retencion=60)
        
    except Exception as e:
        ESTADO_BACKUP['estado'] = 'ERROR'
        ESTADO_BACKUP['error'] = str(e)
        logger.exception(f"Error crítico no controlado durante el backup: {str(e)}")

def _limpiar_backups_antiguos(directorio, dias_retencion=60):
    """
    Evitamos el llenado del disco del cliente eliminando archivos que superen los 2 meses.
    """
    try:
        if not os.path.exists(directorio):
            return
        ahora = datetime.now()
        limite = ahora - timedelta(days=dias_retencion)
        
        for archivo in os.listdir(directorio):
            if archivo.endswith(".dump") or archivo.endswith(".err"):
                ruta_completa = os.path.join(directorio, archivo)
                momento_modificacion = datetime.fromtimestamp(os.path.getmtime(ruta_completa))
                
                if momento_modificacion < limite:
                    os.remove(ruta_completa)
                    logger.info(f"Limpieza: Backup antiguo eliminado: {archivo}")
    except Exception:
        pass
