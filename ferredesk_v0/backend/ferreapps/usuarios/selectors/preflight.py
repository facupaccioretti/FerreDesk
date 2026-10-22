from collections import defaultdict

from django.apps import apps
from django.db import connection, transaction
from django.db.models import Count
from django_tenants.utils import get_public_schema_name, schema_context

from acceso_publico.models import CuentaAccesoPublico
from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.caja.services.control_fondos import _calcular_saldo_teorico_sesion
from ferreapps.clientes.models import Vendedor
from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Auditoria, CliUsuario, Usuario
from ferreapps.ventas.models import Venta
from tenants.models import Dominio, EmpresaTenant


def _hallazgo(codigo, mensaje, datos=None, *, bloqueante=True):
    return {
        "codigo": codigo,
        "mensaje": mensaje,
        "datos": datos or {},
        "bloqueante": bloqueante,
    }


def _normalizar_texto(valor):
    return (valor or "").strip().casefold()


def obtener_tenants_para_preflight():
    public_schema = get_public_schema_name()
    with schema_context(public_schema):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            tenants = list(
                EmpresaTenant.objects.exclude(schema_name=public_schema)
                .order_by("schema_name")
                .values("id", "schema_name", "slug_subdominio", "email_admin", "activo")
            )
            cuentas = list(
                CuentaAccesoPublico.objects.order_by("id").values(
                    "id",
                    "tenant_asignado_id",
                    "email",
                    "username_tenant",
                    "email_tenant",
                    "activo",
                )
            )
            dominios = list(
                Dominio.objects.order_by("id").values(
                    "id",
                    "tenant_id",
                    "domain",
                    "is_primary",
                )
            )

    cuentas_por_tenant = defaultdict(list)
    for cuenta in cuentas:
        cuentas_por_tenant[cuenta["tenant_asignado_id"]].append(cuenta)

    dominios_por_tenant = defaultdict(list)
    for dominio in dominios:
        dominios_por_tenant[dominio["tenant_id"]].append(dominio)

    for tenant in tenants:
        tenant["cuentas_publicas"] = cuentas_por_tenant[tenant["id"]]
        tenant["dominios"] = dominios_por_tenant[tenant["id"]]
    return tenants


def _referencias_a_usuario():
    referencias = []
    for model in apps.get_models():
        if not model._meta.managed or model._meta.proxy:
            continue
        for field in model._meta.get_fields():
            if not getattr(field, "concrete", False):
                continue
            if not (getattr(field, "many_to_one", False) or getattr(field, "one_to_one", False)):
                continue
            if getattr(field.remote_field, "model", None) is not Usuario:
                continue

            filas = list(
                model._default_manager.exclude(**{f"{field.name}__isnull": True})
                .values(field.attname)
                .annotate(filas=Count("pk"))
                .order_by(field.attname)
            )
            if filas:
                referencias.append(
                    {
                        "modelo": model._meta.label,
                        "campo": field.name,
                        "attname": field.attname,
                        "usuarios": filas,
                    }
                )
    return referencias


def _auditar_cuenta_publica(tenant, usuarios):
    hallazgos = []
    cuentas = tenant["cuentas_publicas"]
    dominios_primarios = [dominio for dominio in tenant["dominios"] if dominio["is_primary"]]

    if len(cuentas) != 1:
        hallazgos.append(
            _hallazgo(
                "CUENTA_PUBLICA_CANTIDAD_INVALIDA",
                "Debe existir exactamente una cuenta publica para el tenant.",
                {"cantidad": len(cuentas), "cuenta_ids": [cuenta["id"] for cuenta in cuentas]},
            )
        )
    elif not cuentas[0]["activo"]:
        hallazgos.append(
            _hallazgo(
                "CUENTA_PUBLICA_INACTIVA",
                "La cuenta publica asociada esta inactiva.",
                {"cuenta_id": cuentas[0]["id"]},
            )
        )

    if len(dominios_primarios) != 1:
        hallazgos.append(
            _hallazgo(
                "DOMINIO_PRIMARIO_CANTIDAD_INVALIDA",
                "Debe existir exactamente un dominio primario para el tenant.",
                {
                    "cantidad": len(dominios_primarios),
                    "dominios": [dominio["domain"] for dominio in dominios_primarios],
                },
            )
        )

    if len(cuentas) == 1:
        cuenta = cuentas[0]
        valores = {
            "cuenta_publica.email": cuenta["email"],
            "tenant.email_admin": tenant["email_admin"],
            "cuenta_publica.username_tenant": cuenta["username_tenant"],
            "cuenta_publica.email_tenant": cuenta["email_tenant"],
            "usuarios": [
                {
                    "id": usuario["id"],
                    "username": usuario["username"],
                    "email": usuario["email"],
                }
                for usuario in usuarios
            ],
        }
        discordancias = []
        email_cuenta = _normalizar_texto(cuenta["email"])
        email_admin = _normalizar_texto(tenant["email_admin"])
        if not email_cuenta or not email_admin or email_cuenta != email_admin:
            discordancias.append("cuenta_publica.email != tenant.email_admin")
        username_cuenta = cuenta["username_tenant"] or ""
        email_tenant = _normalizar_texto(cuenta["email_tenant"])
        usuarios_coincidentes = [
            usuario
            for usuario in usuarios
            if username_cuenta
            and username_cuenta == usuario["username"]
            and email_tenant
            and email_tenant == _normalizar_texto(usuario["email"])
        ]
        if len(usuarios_coincidentes) != 1:
            discordancias.append("cuenta_publica no coincide con un unico Usuario")
        if discordancias:
            hallazgos.append(
                _hallazgo(
                    "CUENTA_PUBLICA_DISCORDANTE",
                    "La cuenta publica no corresponde de forma inequivoca al usuario canonico.",
                    {"discordancias": discordancias, "valores": valores},
                )
            )
    return hallazgos


def _auditar_sucursales_y_legacy():
    hallazgos = []
    sucursales = list(
        Sucursal.objects.order_by("id").values(
            "id", "ferreteria_id", "nombre", "es_principal", "activa"
        )
    )
    if not sucursales:
        hallazgos.append(
            _hallazgo(
                "SUCURSAL_FALTANTE",
                "El tenant no tiene una sucursal base.",
            )
        )

    referencias_sucursal = {
        "sesiones_caja": list(
            SesionCaja.objects.order_by("sucursal").values_list("sucursal", flat=True).distinct()
        ),
        "ventas": list(Venta.objects.order_by("ven_sucursal").values_list("ven_sucursal", flat=True).distinct()),
        "compras": list(
            Compra.objects.order_by("comp_sucursal").values_list("comp_sucursal", flat=True).distinct()
        ),
        "ordenes_compra": list(
            OrdenCompra.objects.order_by("ord_sucursal").values_list("ord_sucursal", flat=True).distinct()
        ),
    }
    if len(sucursales) != 1 or any(referencias_sucursal.values()):
        hallazgos.append(
            _hallazgo(
                "SUCURSALES_LEGACY_INVENTARIO",
                "Inventario de sucursales y campos numericos legacy; no particionan Caja.",
                {"sucursales": sucursales, "referencias": referencias_sucursal},
                bloqueante=False,
            )
        )

    cli_usuarios = list(
        CliUsuario.objects.order_by("id").values("id", "user_id", "cuenta_activa")
    )
    auditorias = Auditoria.objects.count()
    vendedores = list(Vendedor.objects.order_by("id").values("id", "nombre"))
    ventas_no_mostrador = Venta.objects.exclude(ven_idvdo_id=1).count()
    if cli_usuarios or auditorias or vendedores or ventas_no_mostrador:
        hallazgos.append(
            _hallazgo(
                "DATOS_LEGACY_INVENTARIO",
                "Inventario de tablas legacy que deben conservarse o revisarse antes de su retiro.",
                {
                    "cli_usuarios": cli_usuarios,
                    "auditorias": auditorias,
                    "vendedores": vendedores,
                    "ventas_no_mostrador": ventas_no_mostrador,
                },
                bloqueante=False,
            )
        )
    return hallazgos, sucursales


def auditar_schema_tenant(tenant):
    hallazgos = []
    with schema_context(tenant["schema_name"]):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            hallazgos.extend(_auditar_schema_tenant_en_transaccion(tenant))
    return hallazgos


def _auditar_schema_tenant_en_transaccion(tenant):
    hallazgos = []
    usuarios = list(
        Usuario.objects.order_by("id").values(
            "id", "username", "email", "is_active", "ferreteria_id"
        )
    )
    ferreterias = list(Ferreteria.objects.order_by("id").values("id", "nombre"))

    if len(usuarios) != 1:
        hallazgos.append(
            _hallazgo(
                "USUARIO_CANONICO_CANTIDAD_INVALIDA",
                "Debe existir exactamente un Usuario canonico.",
                {
                    "cantidad": len(usuarios),
                    "usuarios": [
                        {
                            "id": usuario["id"],
                            "username": usuario["username"],
                            "email": usuario["email"],
                            "is_active": usuario["is_active"],
                        }
                        for usuario in usuarios
                    ],
                },
            )
        )
    elif not usuarios[0]["is_active"]:
        hallazgos.append(
            _hallazgo(
                "USUARIO_CANONICO_INACTIVO",
                "El Usuario canonico esta inactivo.",
                {"usuario_id": usuarios[0]["id"]},
            )
        )

    if len(ferreterias) != 1:
        hallazgos.append(
            _hallazgo(
                "FERRETERIA_CANTIDAD_INVALIDA",
                "Debe existir exactamente una Ferreteria.",
                {"cantidad": len(ferreterias), "ferreteria_ids": [item["id"] for item in ferreterias]},
            )
        )

    hallazgos.extend(_auditar_cuenta_publica(tenant, usuarios))
    hallazgos_sucursal, sucursales = _auditar_sucursales_y_legacy()
    hallazgos.extend(hallazgos_sucursal)

    if len(ferreterias) == 1:
        ferreteria_id = ferreterias[0]["id"]
        usuarios_invalidos = [
            usuario["id"] for usuario in usuarios if usuario["ferreteria_id"] != ferreteria_id
        ]
        sucursales_invalidas = [
            sucursal["id"] for sucursal in sucursales if sucursal["ferreteria_id"] != ferreteria_id
        ]
        if usuarios_invalidos or sucursales_invalidas:
            hallazgos.append(
                _hallazgo(
                    "RELACION_FERRETERIA_INVALIDA",
                    "Usuarios o sucursales no apuntan a la unica Ferreteria del tenant.",
                    {
                        "ferreteria_id": ferreteria_id,
                        "usuario_ids": usuarios_invalidos,
                        "sucursal_ids": sucursales_invalidas,
                    },
                )
            )

    referencias_usuario = _referencias_a_usuario()
    if len(usuarios) == 1:
        usuario_id = usuarios[0]["id"]
        referencias_invalidas = []
        for referencia in referencias_usuario:
            usuarios_referidos = [
                fila
                for fila in referencia["usuarios"]
                if fila[referencia["attname"]] != usuario_id
            ]
            if usuarios_referidos:
                referencias_invalidas.append({**referencia, "usuarios": usuarios_referidos})
        if referencias_invalidas:
            hallazgos.append(
                _hallazgo(
                    "REFERENCIA_USUARIO_NO_CANONICO",
                    "Hay relaciones operativas ligadas a una cuenta distinta de la canonica.",
                    {"usuario_canonico_id": usuario_id, "referencias": referencias_invalidas},
                )
            )
    elif referencias_usuario:
        hallazgos.append(
            _hallazgo(
                "REFERENCIAS_USUARIO_AMBIGUAS",
                "Las relaciones a Usuario no admiten un backfill inequivoco.",
                {"referencias": referencias_usuario},
            )
        )

    cajas_abiertas = []
    for sesion in SesionCaja.objects.filter(estado=ESTADO_CAJA_ABIERTA).select_related("usuario").order_by("id"):
        try:
            saldo_teorico = str(_calcular_saldo_teorico_sesion(sesion))
        except Exception as exc:
            saldo_teorico = f"no_calculable:{exc.__class__.__name__}"
        cajas_abiertas.append(
            {
                "id": sesion.id,
                "fecha_hora_inicio": sesion.fecha_hora_inicio,
                "usuario_id": sesion.usuario_id,
                "sucursal": sesion.sucursal,
                "saldo_teorico": saldo_teorico,
            }
        )
    if cajas_abiertas:
        hallazgos.append(
            _hallazgo(
                "CAJAS_ABIERTAS",
                "La ventana de despliegue exige cero cajas abiertas.",
                {"cantidad": len(cajas_abiertas), "sesiones": cajas_abiertas},
            )
        )

    return hallazgos
