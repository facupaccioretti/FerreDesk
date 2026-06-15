import os
import uuid

import django
from dotenv import load_dotenv


REQUIRED_R2_ENV_VARS = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ENDPOINT_URL",
)
CONTENT = b"ferredesk-r2-integration-test"


def _load_environment():
    load_dotenv()
    missing = [name for name in REQUIRED_R2_ENV_VARS if not os.environ.get(name)]
    if missing:
        missing_list = ", ".join(missing)
        raise EnvironmentError(
            f"FALLO: faltan variables de entorno de R2: {missing_list}"
        )

    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        "ferredesk_backend.settings.prod",
    )


def main():
    _load_environment()
    django.setup()

    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage

    unique_name = uuid.uuid4().hex
    test_path = f"_integration_tests/{unique_name}/test_upload.txt"
    saved_path = None

    try:
        saved_path = default_storage.save(test_path, ContentFile(CONTENT))
        assert default_storage.exists(
            saved_path
        ), "FALLO: archivo no existe despues de guardar"

        with default_storage.open(saved_path, "rb") as uploaded_file:
            read_content = uploaded_file.read()

        assert (
            read_content == CONTENT
        ), f"FALLO: contenido no coincide. Leido: {read_content!r}"
        print(f"OK: subida y lectura exitosa en {saved_path}")
    except Exception as exc:
        print(f"ERROR: fallo la integracion con storage remoto: {exc}")
        raise
    finally:
        cleanup_path = saved_path or test_path
        try:
            if default_storage.exists(cleanup_path):
                default_storage.delete(cleanup_path)
                print(f"OK: archivo de test eliminado de R2: {cleanup_path}")
        except Exception as cleanup_error:
            print(
                "WARN: no se pudo limpiar el archivo de prueba "
                f"{cleanup_path}: {cleanup_error}"
            )


if __name__ == "__main__":
    main()
