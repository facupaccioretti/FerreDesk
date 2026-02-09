"""
Paquete de tests modularizados para el módulo de Caja.

Los tests están organizados en archivos específicos según su funcionalidad:
- mixins.py: Fixtures y mixins compartidos
- test_modelos.py: Tests de modelos
- test_api_*.py: Tests de endpoints API
- test_logica_*.py: Tests de lógica de negocio
- test_integracion_*.py: Tests de integración
- test_utilidades_*.py: Tests de funciones utilitarias
- test_cheques.py: Tests específicos de cheques

Para ejecutar todos los tests:
    python manage.py test ferreapps.caja --keepdb

Para ejecutar un archivo específico:
    python manage.py test ferreapps.caja.tests.test_modelos --keepdb
"""

# Importar todas las clases de tests para mantener compatibilidad
from .mixins import CajaTestMixin
from .test_modelos import (
    MetodoPagoModelTests,
    SesionCajaModelTests,
    MovimientoCajaModelTests,
)
from .test_api_sesiones import SesionCajaAPITests
from .test_api_movimientos import MovimientoCajaAPITests
from .test_api_metodos_pago import MetodoPagoAPITests
from .test_logica_saldo import CalculoSaldoTeoricoTests
from .test_logica_cierre import CierreCajaTests
from .test_integracion_recibos import ReciboRequiereCajaTests
from .test_utilidades_pagos import (
    RegistrarPagosVentaTests,
    AjustarPagosPorVueltoTests,
    NormalizarCobroTests,
    ResumenCierreExcedentesTests,
)
from .test_cheques import ChequeRechazadoYReactivarTests

__all__ = [
    'CajaTestMixin',
    'MetodoPagoModelTests',
    'SesionCajaModelTests',
    'MovimientoCajaModelTests',
    'SesionCajaAPITests',
    'MovimientoCajaAPITests',
    'MetodoPagoAPITests',
    'CalculoSaldoTeoricoTests',
    'CierreCajaTests',
    'ReciboRequiereCajaTests',
    'RegistrarPagosVentaTests',
    'AjustarPagosPorVueltoTests',
    'NormalizarCobroTests',
    'ResumenCierreExcedentesTests',
    'ChequeRechazadoYReactivarTests',
]
