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

logger = logging.getLogger(__name__)


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
            
        logger.info(f"Normalizando archivos ARCA para ferretería {instance.id}")
        
        # Crear directorios base
        base_dir = os.path.join(settings.MEDIA_ROOT, 'arca', f'ferreteria_{instance.id}')
        certificados_dir = os.path.join(base_dir, 'certificados')
        claves_dir = os.path.join(base_dir, 'claves_privadas')
        
        os.makedirs(certificados_dir, exist_ok=True)
        os.makedirs(claves_dir, exist_ok=True)
        
        # Procesar certificado por carpeta (no depender de instance.certificado_arca.path)
        if _normalizar_archivo_en_carpeta(certificados_dir, 'certificado.pem'):
            instance.certificado_arca.name = f'arca/ferreteria_{instance.id}/certificados/certificado.pem'
            logger.info(f"✅ Certificado normalizado: {os.path.join(certificados_dir, 'certificado.pem')}")
        
        # Procesar clave privada por carpeta (no depender de instance.clave_privada_arca.path)
        if _normalizar_archivo_en_carpeta(claves_dir, 'clave_privada.pem'):
            instance.clave_privada_arca.name = f'arca/ferreteria_{instance.id}/claves_privadas/clave_privada.pem'
            logger.info(f"✅ Clave privada normalizada: {os.path.join(claves_dir, 'clave_privada.pem')}")
        
        # Guardar cambios en la BD (sin llamar save() para evitar bucle)
        from django.db import connection
        with connection.cursor() as cursor:
            if instance.certificado_arca:
                cursor.execute(
                    "UPDATE productos_ferreteria SET certificado_arca = %s WHERE id = %s",
                    [instance.certificado_arca.name, instance.id]
                )
            if instance.clave_privada_arca:
                cursor.execute(
                    "UPDATE productos_ferreteria SET clave_privada_arca = %s WHERE id = %s",
                    [instance.clave_privada_arca.name, instance.id]
                )
        
        logger.info(f"Archivos ARCA normalizados exitosamente para ferretería {instance.id}")
        
    except Exception as e:
        logger.error(f"Error normalizando archivos ARCA para ferretería {instance.id}: {e}")
        # No re-lanzar la excepción para no romper el save() original
