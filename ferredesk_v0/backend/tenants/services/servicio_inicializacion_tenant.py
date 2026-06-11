"""Servicios de inicializacion de datos base dentro del tenant."""

from django.db import connection, transaction

from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Usuario


def inicializar_datos_tenant(tenant, email, password):
    """Crea los datos minimos del tenant y retorna las entidades creadas."""
    tenant_anterior = getattr(connection, "tenant", None)

    try:
        connection.set_tenant(tenant)

        with transaction.atomic():
            ferreteria = Ferreteria.objects.create(
                nombre=tenant.nombre,
                direccion="",
                telefono="",
                email=email,
            )

            sucursal = Sucursal.objects.create(
                ferreteria=ferreteria,
                nombre="Principal",
                direccion="",
                telefono="",
                es_principal=True,
                activa=True,
            )

            usuario = Usuario.objects.create_user(
                username=email,
                email=email,
                password=password,
                tipo_usuario="admin",
                is_staff=False,
                is_superuser=False,
                ferreteria=ferreteria,
            )

        return {
            "usuario": usuario,
            "ferreteria": ferreteria,
            "sucursal": sucursal,
        }
    finally:
        if tenant_anterior is not None:
            connection.set_tenant(tenant_anterior)
        else:
            connection.set_schema_to_public()
