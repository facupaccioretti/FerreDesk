"""
Señales para el manejo post-save de archivos ARCA
================================================

Maneja la normalización de archivos de certificados y claves privadas
después de que Django los haya guardado correctamente en disco.
"""

import os
import shutil
import logging
import glob
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from ferreapps.productos.utils.file_paths import (
    obtener_directorio_arca_por_schema_absoluto,
    obtener_schema_name_para_archivos,
)

logger = logging.getLogger(__name__)


def _limpiar_archivos_anteriores(directorio: str, archivo_actual: str) -> None:
    """
    Limpia archivos anteriores en un directorio, manteniendo solo el archivo actual.
    
    Args:
        directorio: Directorio donde limpiar archivos
        archivo_actual: Nombre del archivo actual a mantener
    """
    try:
        if not os.path.exists(directorio):
            return
            
        # Obtener solo el nombre del archivo (sin ruta completa)
        nombre_archivo_actual = os.path.basename(archivo_actual)
        
        # Limpiar archivos que no sean el actual
        for archivo in os.listdir(directorio):
            if archivo != nombre_archivo_actual:
                archivo_path = os.path.join(directorio, archivo)
                # Solo eliminar archivos (no directorios)
                if os.path.isfile(archivo_path):
                    try:
                        os.remove(archivo_path)
                        logger.info(f"🗑️ Archivo anterior eliminado: {archivo}")
                    except Exception as e:
                        logger.warning(f"No se pudo eliminar archivo anterior {archivo}: {e}")
    except Exception as e:
        logger.error(f"Error limpiando archivos anteriores en {directorio}: {e}")


def _normalizar_archivo_en_carpeta(directorio_destino: str, nombre_estandar: str) -> bool:
    """
    Normaliza archivos en una carpeta tomando el .pem más reciente como fuente
    y garantizando que solo quede el archivo con nombre estándar.

    Retorna True si se normalizó algún archivo, False si no había nada que hacer.
    """
    os.makedirs(directorio_destino, exist_ok=True)

    # Candidatos actuales en la carpeta
    candidatos = glob.glob(os.path.join(directorio_destino, "*.pem"))
    if not candidatos:
        return False

    # Elegir el archivo más reciente por fecha de modificación
    candidato_nuevo = max(candidatos, key=lambda p: os.path.getmtime(p))

    destino = os.path.join(directorio_destino, nombre_estandar)

    # Si el candidato ya tiene el nombre estándar, no lo borres ni intentes moverlo sobre sí mismo
    mismo_archivo = os.path.normcase(os.path.abspath(candidato_nuevo)) == os.path.normcase(os.path.abspath(destino))

    if not mismo_archivo:
        # Eliminar destino previo si existe (reemplazo directo)
        if os.path.exists(destino):
            try:
                os.remove(destino)
            except Exception:
                pass
        # Mover/renombrar el elegido al nombre estándar
        try:
            shutil.move(candidato_nuevo, destino)
        except Exception:
            # Si no se pudo mover, no continuar con limpieza para no perder referencia
            return False

    # Limpiar cualquier remanente que no sea el estándar
    try:
        for archivo in os.listdir(directorio_destino):
            if archivo != nombre_estandar:
                archivo_path = os.path.join(directorio_destino, archivo)
                # Solo eliminar archivos (no directorios)
                if os.path.isfile(archivo_path):
                    try:
                        os.remove(archivo_path)
                    except Exception:
                        pass
    except Exception:
        pass

    return True


@receiver(post_save, sender='productos.Ferreteria')
def normalizar_archivos_arca(sender, instance, created, **kwargs):
    """
    Normaliza archivos ARCA después de que Django los haya guardado.
    
    Args:
        sender: El modelo que disparó la señal
        instance: La instancia de Ferreteria guardada
        created: True si es una nueva instancia
    """
    try:
        # Solo procesar si hay archivos ARCA
        if not instance.certificado_arca and not instance.clave_privada_arca:
            return
            
        logger.info("Normalizando archivos ARCA para schema %s", obtener_schema_name_para_archivos())
        
        # Crear directorios base
        schema_name = obtener_schema_name_para_archivos()
        base_dir = obtener_directorio_arca_por_schema_absoluto(
            os.path.join(settings.MEDIA_ROOT, 'arca')
        )
        certificados_dir = os.path.join(base_dir, 'certificados')
        claves_dir = os.path.join(base_dir, 'claves_privadas')
        
        os.makedirs(certificados_dir, exist_ok=True)
        os.makedirs(claves_dir, exist_ok=True)
        
        # Limpiar archivos anteriores de certificados
        if instance.certificado_arca:
            _limpiar_archivos_anteriores(certificados_dir, instance.certificado_arca.path)
            logger.info("✅ Certificado procesado: %s", instance.certificado_arca.path)
        
        # Limpiar archivos anteriores de claves privadas
        if instance.clave_privada_arca:
            _limpiar_archivos_anteriores(claves_dir, instance.clave_privada_arca.path)
            logger.info("✅ Clave privada procesada: %s", instance.clave_privada_arca.path)
        
        logger.info("✅ Archivos ARCA procesados exitosamente para schema %s", schema_name)
        
    except Exception as e:
        logger.error("Error procesando archivos ARCA para ferretería %s: %s", instance.id, e)
        # No re-lanzar la excepción para no romper el save() original
