from cryptography import x509
from cryptography.hazmat.primitives import serialization


def _leer_bytes_archivo(archivo) -> bytes:
    try:
        archivo.seek(0)
    except Exception:
        pass

    contenido = archivo.read()

    try:
        archivo.seek(0)
    except Exception:
        pass

    return contenido


def validar_certificado_pem(archivo) -> None:
    contenido = _leer_bytes_archivo(archivo)
    x509.load_pem_x509_certificate(contenido)


def validar_clave_privada_pem(archivo) -> None:
    contenido = _leer_bytes_archivo(archivo)
    serialization.load_pem_private_key(contenido, password=None)
