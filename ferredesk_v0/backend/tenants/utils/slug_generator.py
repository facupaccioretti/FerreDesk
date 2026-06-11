"""Generacion de slugs sugeridos para tenants."""

import re

from django.core.exceptions import ValidationError
from django.utils.text import slugify

from tenants.constants import SLUG_MAX_LENGTH, SLUG_MIN_LENGTH
from tenants.models import EmpresaTenant
from tenants.validators import validar_slug_formato, validar_slug_no_reservado


def generar_slug_desde_nombre(nombre):
    """Genera un slug sugerido y agrega un sufijo secuencial si hace falta."""
    nombre_normalizado = (nombre or "").strip().lower().replace(" ", "-")
    slug_base = slugify(nombre_normalizado)
    slug_base = re.sub(r"-{2,}", "-", slug_base).strip("-")

    if not slug_base:
        slug_base = "empresa"

    slug_base = slug_base[:SLUG_MAX_LENGTH].strip("-")

    if len(slug_base) < SLUG_MIN_LENGTH:
        slug_base = f"{slug_base}empresa"[:SLUG_MAX_LENGTH].strip("-")

    candidato = slug_base
    secuencia = 2

    while True:
        try:
            validar_slug_formato(candidato)
            validar_slug_no_reservado(candidato)
        except ValidationError:
            sufijo = f"-{secuencia}"
            longitud_base = SLUG_MAX_LENGTH - len(sufijo)
            base_con_sufijo = slug_base[:longitud_base].rstrip("-")
            candidato = f"{base_con_sufijo}{sufijo}"
            secuencia += 1
            continue

        if not EmpresaTenant.objects.filter(slug_subdominio=candidato).exists():
            return candidato

        sufijo = f"-{secuencia}"
        longitud_base = SLUG_MAX_LENGTH - len(sufijo)
        base_con_sufijo = slug_base[:longitud_base].rstrip("-")
        candidato = f"{base_con_sufijo}{sufijo}"
        secuencia += 1
