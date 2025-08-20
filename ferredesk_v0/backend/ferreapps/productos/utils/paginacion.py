from rest_framework.pagination import PageNumberPagination
from django.conf import settings


class PaginacionPorPaginaConLimite(PageNumberPagination):
    """
    Paginación por número de página con soporte para el parámetro de tamaño `limit`.

    - page_size: tamaño por defecto, configurable vía settings.TAMANIO_PAGINA_POR_DEFECTO
    - page_size_query_param: `limit` para pedir tamaños variables por request
    - max_page_size: tope superior seguro, configurable vía settings.TAMANIO_PAGINA_MAXIMA
    """

    page_size = getattr(settings, 'TAM_PAGINA_POR_DEFECTO', 50)
    page_size_query_param = 'limit'
    max_page_size = getattr(settings, 'TAM_PAGINA_MAXIMA', 200)


