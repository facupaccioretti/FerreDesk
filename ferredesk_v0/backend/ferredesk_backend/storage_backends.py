from storages.backends.s3boto3 import S3Boto3Storage


class R2MediaStorage(S3Boto3Storage):
    """
    Storage media para Cloudflare R2.

    Los nombres se calculan por tenant y son determinísticos, por lo que evitamos
    consultas HEAD previas para buscar un nombre disponible en cada guardado.
    """

    file_overwrite = True
