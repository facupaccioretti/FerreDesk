"""Provisioning sincronico del onboarding SaaS con trazabilidad persistida."""

import logging

from django.db import IntegrityError, connection, transaction

from acceso_publico.models import CuentaAccesoPublico
from acceso_publico.services import crear_cuenta_acceso_publico
from tenants.models import SolicitudOnboardingTenant
from tenants.services.servicio_constructor_tenant import crear_tenant
from tenants.services.servicio_inicializacion_tenant import inicializar_datos_tenant
from tenants.services.verificacion_email_service import generar_y_enviar_token_verificacion

logger = logging.getLogger(__name__)


class ProvisioningOnboardingError(Exception):
    """Error controlado para traducir fallos de provisioning a HTTP/estado."""

    def __init__(self, *, error_codigo, error_detalle, mensaje_publico, status_code):
        super().__init__(error_detalle)
        self.error_codigo = error_codigo
        self.error_detalle = error_detalle
        self.mensaje_publico = mensaje_publico
        self.status_code = status_code


def _payload_resumen_base(*, nombre, slug, email_admin):
    return {
        "nombre": nombre,
        "slug": slug,
        "email_admin": email_admin,
    }


def crear_solicitud_onboarding(*, nombre, slug, email_admin):
    solicitud = SolicitudOnboardingTenant.objects.create(
        nombre=nombre,
        slug=slug,
        email_admin=email_admin,
        estado=SolicitudOnboardingTenant.ESTADO_PENDIENTE,
        payload_resumen=_payload_resumen_base(
            nombre=nombre,
            slug=slug,
            email_admin=email_admin,
        ),
    )
    logger.info(
        "Solicitud onboarding creada id=%s slug=%s email=%s",
        solicitud.id,
        slug,
        email_admin,
    )
    return solicitud


def _actualizar_solicitud_estado(solicitud, *, estado, tenant=None, error_codigo="", error_detalle="", payload_extra=None):
    payload = dict(solicitud.payload_resumen or {})
    if payload_extra:
        payload.update(payload_extra)

    solicitud.estado = estado
    solicitud.tenant = tenant
    solicitud.error_codigo = error_codigo
    solicitud.error_detalle = error_detalle
    solicitud.payload_resumen = payload

    campos = [
        "estado",
        "tenant",
        "error_codigo",
        "error_detalle",
        "payload_resumen",
        "actualizado_en",
    ]
    solicitud.save(update_fields=campos)


def _marcar_solicitud_en_proceso(solicitud):
    solicitud.estado = SolicitudOnboardingTenant.ESTADO_EN_PROCESO
    solicitud.intentos += 1
    solicitud.save(update_fields=["estado", "intentos", "actualizado_en"])


def _eliminar_tenant_fallido(tenant):
    if tenant is None:
        return

    connection.set_schema_to_public()
    CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
    tenant.delete(force_drop=True)


def provisionar_tenant_completo(*, nombre, slug, email, password, solicitud=None):
    tenant = None
    contexto = f"solicitud_id={solicitud.id} slug={slug}" if solicitud else f"slug={slug}"

    if solicitud is not None:
        _marcar_solicitud_en_proceso(solicitud)

    logger.info("Onboarding provisioning iniciado %s", contexto)

    try:
        logger.info("Onboarding etapa crear_tenant %s", contexto)
        tenant = crear_tenant(
            nombre=nombre,
            slug=slug,
            email_admin=email,
        )

        logger.info("Onboarding etapa inicializar_schema %s schema=%s", contexto, tenant.schema_name)
        with transaction.atomic():
            datos_iniciales = inicializar_datos_tenant(
                tenant=tenant,
                email=email,
                password=password,
            )

            logger.info("Onboarding etapa cuenta_publica %s schema=%s", contexto, tenant.schema_name)
            cuenta_acceso_publico = crear_cuenta_acceso_publico(
                email=email,
                password=password,
                nombre_mostrar=nombre,
                tenant=tenant,
                username_tenant=datos_iniciales["usuario"].username,
                email_tenant=datos_iniciales["usuario"].email,
            )

            logger.info("Onboarding etapa email_verificacion %s schema=%s", contexto, tenant.schema_name)
            generar_y_enviar_token_verificacion(tenant=tenant)

        resultado = {
            "tenant": tenant,
            "dominio": tenant.get_primary_domain(),
            "usuario": datos_iniciales["usuario"],
            "cuenta_acceso_publico": cuenta_acceso_publico,
        }

        if solicitud is not None:
            _actualizar_solicitud_estado(
                solicitud,
                estado=SolicitudOnboardingTenant.ESTADO_COMPLETADO,
                tenant=tenant,
                payload_extra={
                    "tenant_id": tenant.id,
                    "schema_name": tenant.schema_name,
                    "dominio": resultado["dominio"].domain if resultado["dominio"] else "",
                    "usuario_admin": datos_iniciales["usuario"].username,
                },
            )

        logger.info("Onboarding provisioning completado %s schema=%s", contexto, tenant.schema_name)
        return resultado
    except IntegrityError as exc:
        logger.warning("Onboarding conflicto_integridad %s detalle=%s", contexto, str(exc))
        _eliminar_tenant_fallido(tenant)
        if solicitud is not None:
            _actualizar_solicitud_estado(
                solicitud,
                estado=SolicitudOnboardingTenant.ESTADO_ERROR,
                error_codigo="conflicto_integridad",
                error_detalle=str(exc),
            )
        raise ProvisioningOnboardingError(
            error_codigo="conflicto_integridad",
            error_detalle=str(exc),
            mensaje_publico="No se pudo completar el alta porque el tenant entro en conflicto con un recurso existente.",
            status_code=409,
        ) from exc
    except Exception as exc:
        logger.exception("Onboarding provisioning_error %s", contexto)
        _eliminar_tenant_fallido(tenant)
        if solicitud is not None:
            _actualizar_solicitud_estado(
                solicitud,
                estado=SolicitudOnboardingTenant.ESTADO_ERROR,
                error_codigo="provisioning_error",
                error_detalle=str(exc),
            )
        raise ProvisioningOnboardingError(
            error_codigo="provisioning_error",
            error_detalle=str(exc),
            mensaje_publico="No se pudo completar el alta del negocio. Reintenta mas tarde o usa el identificador de solicitud para soporte.",
            status_code=500,
        ) from exc
