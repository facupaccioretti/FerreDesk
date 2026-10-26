from .administracion import (
    CatalogoPermisosAPIView,
    PerfilAdminDetailAPIView,
    PerfilesAdminListCreateAPIView,
)
from .registro_legacy import register
from .sesion import (
    ActivarPerfilesAPIView,
    ActividadPerfilAPIView,
    BloquearPerfilAPIView,
    CambiarPerfilAPIView,
    IdentificarPerfilAPIView,
    OpcionesActorAPIView,
    SeleccionPerfilesAPIView,
)


__all__ = (
    'register',
    'CatalogoPermisosAPIView',
    'PerfilAdminDetailAPIView',
    'PerfilesAdminListCreateAPIView',
    'ActivarPerfilesAPIView',
    'ActividadPerfilAPIView',
    'BloquearPerfilAPIView',
    'CambiarPerfilAPIView',
    'IdentificarPerfilAPIView',
    'OpcionesActorAPIView',
    'SeleccionPerfilesAPIView',
)
