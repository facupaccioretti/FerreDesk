import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'ferredesk_backend.settings.prod'
django.setup()
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

try:
    content = b"test-ferredesk-r2"
    path = default_storage.save("_test/conexion.txt", ContentFile(content))
    assert default_storage.exists(path), "FALLO: archivo no encontrado despues de guardar"
    default_storage.delete(path)
    print("OK: conexion con R2 verificada")
except Exception as e:
    print("Error conectando a R2:", e)
