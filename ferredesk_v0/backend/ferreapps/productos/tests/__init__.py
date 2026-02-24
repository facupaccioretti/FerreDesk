"""
Tests modularizados para la aplicación de productos.
python manage.py test ferreapps.productos
"""
# Importar todos los tests para que Django los descubra
from .test_models_listas_precio import *
from .test_utils_precios import *
from .test_api_listas_precio import *
from .test_api_precios_producto import *
from .test_stock_serializer_precios import *
from .test_auditoria_listas import *
