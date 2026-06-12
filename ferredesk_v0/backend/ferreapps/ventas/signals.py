"""
Señales para el manejo post-save de archivos ARCA
================================================

Maneja la normalización de archivos de certificados y claves privadas
después de que Django los haya guardado correctamente en disco.
"""

import os
import shutil
import logging
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


def _normalizar_archivo_subido(
    instance,
    field_name: str,
    directorio_destino: str,
    nombre_estandar: str,
    ruta_relativa_destino: str,
) -> bool:
    archivo = getattr(instance, field_name, None)
    if not archivo:
        return False

    try:
        origen_path = archivo.path
    except Exception:
        return False

    os.makedirs(directorio_destino, exist_ok=True)
    destino = os.path.join(directorio_destino, nombre_estandar)

    mismo_archivo = os.path.normcase(os.path.abspath(origen_path)) == os.path.normcase(os.path.abspath(destino))

    if not mismo_archivo:
        if os.path.exists(destino):
            try:
                os.remove(destino)
            except Exception:
                pass

        try:
            shutil.move(origen_path, destino)
        except Exception:
            return False

    _limpiar_archivos_anteriores(directorio_destino, destino)
    getattr(instance, field_name).name = ruta_relativa_destino
    instance.__class__.objects.filter(pk=instance.pk).update(**{field_name: ruta_relativa_destino})
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
        
        certificado_relativo = f"arca/{schema_name}/certificados/certificado.pem"
        clave_relativa = f"arca/{schema_name}/claves_privadas/clave_privada.pem"

        if instance.certificado_arca:
            _normalizar_archivo_subido(
                instance=instance,
                field_name='certificado_arca',
                directorio_destino=certificados_dir,
                nombre_estandar='certificado.pem',
                ruta_relativa_destino=certificado_relativo,
            )
            logger.info("✅ Certificado procesado: %s", certificado_relativo)
        
        if instance.clave_privada_arca:
            _normalizar_archivo_subido(
                instance=instance,
                field_name='clave_privada_arca',
                directorio_destino=claves_dir,
                nombre_estandar='clave_privada.pem',
                ruta_relativa_destino=clave_relativa,
            )
            logger.info("✅ Clave privada procesada: %s", clave_relativa)
        
        logger.info("✅ Archivos ARCA procesados exitosamente para schema %s", schema_name)
        
    except Exception as e:
        logger.error("Error procesando archivos ARCA para ferretería %s: %s", instance.id, e)
        # No re-lanzar la excepción para no romper el save() original
