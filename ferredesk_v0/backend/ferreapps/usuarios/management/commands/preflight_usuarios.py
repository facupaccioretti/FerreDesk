import json

from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError

from ferreapps.usuarios.selectors.preflight import (
    auditar_schema_tenant,
    obtener_tenants_para_preflight,
)


class Command(BaseCommand):
    help = "Audita datos previos al modulo de Usuarios sin realizar escrituras."

    def handle(self, *args, **options):
        tenants = obtener_tenants_para_preflight()
        bloqueantes = 0
        informativos = 0

        for tenant in tenants:
            schema_name = tenant["schema_name"]
            try:
                hallazgos = auditar_schema_tenant(tenant)
            except DatabaseError as exc:
                hallazgos = [
                    {
                        "codigo": "SCHEMA_INACCESIBLE",
                        "mensaje": "No se pudo auditar el schema tenant.",
                        "datos": {"error": exc.__class__.__name__},
                        "bloqueante": True,
                    }
                ]
            except Exception as exc:
                hallazgos = [
                    {
                        "codigo": "SCHEMA_AUDITORIA_FALLIDA",
                        "mensaje": "La auditoria del schema fallo de forma inesperada.",
                        "datos": {"error": exc.__class__.__name__},
                        "bloqueante": True,
                    }
                ]

            if not hallazgos:
                self.stdout.write(f"[OK] schema={schema_name}")
                continue

            for hallazgo in hallazgos:
                nivel = "BLOQUEANTE" if hallazgo["bloqueante"] else "INFO"
                if hallazgo["bloqueante"]:
                    bloqueantes += 1
                else:
                    informativos += 1
                datos = json.dumps(
                    hallazgo["datos"],
                    ensure_ascii=True,
                    sort_keys=True,
                    default=str,
                )
                self.stdout.write(
                    f"[{nivel}] schema={schema_name} codigo={hallazgo['codigo']} "
                    f"problema={hallazgo['mensaje']} datos={datos}"
                )

        self.stdout.write(
            f"Resumen: schemas={len(tenants)} bloqueantes={bloqueantes} informativos={informativos}"
        )
        if bloqueantes:
            raise CommandError(f"Preflight bloqueado: {bloqueantes} problema(s) bloqueante(s).")

        self.stdout.write(self.style.SUCCESS("Preflight de Usuarios sin bloqueantes."))
