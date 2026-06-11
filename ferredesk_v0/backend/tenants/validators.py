"""Validadores y utilidades para slugs de subdominio."""

import re

from django.core.exceptions import ValidationError
from django.utils.text import slugify

from tenants.constants import (
    SLUG_MAX_LENGTH,
    SLUG_MIN_LENGTH,
    SUBDOMINIOS_RESERVADOS,
)
from tenants.models import EmpresaTenant


PATRON_SLUG = re.compile(r"^[a-z0-9-]+$")


def validar_slug_formato(slug):
    """Valida el formato base permitido para un subdominio."""
    if not isinstance(slug, str):
        raise ValidationError("El subdominio debe ser una cadena de texto.")

    if len(slug) < SLUG_MIN_LENGTH or len(slug) > SLUG_MAX_LENGTH:
        raise ValidationError(
            f"El subdominio debe tener entre {SLUG_MIN_LENGTH} y {SLUG_MAX_LENGTH} caracteres."
        )

    if not PATRON_SLUG.fullmatch(slug):
        raise ValidationError(
            "El subdominio solo puede contener letras minúsculas, números y guiones."
        )

    if slug.startswith("-") or slug.endswith("-"):
        raise ValidationError("El subdominio no puede empezar ni terminar con guión.")

    if "--" in slug:
        raise ValidationError("El subdominio no puede contener guiones consecutivos.")


def validar_slug_no_reservado(slug):
    """Impide usar subdominios reservados por la plataforma."""
    if slug in SUBDOMINIOS_RESERVADOS:
        raise ValidationError("El subdominio seleccionado está reservado.")


def validar_slug_unico(slug):
    """Verifica que el subdominio no exista ya en otro tenant."""
    if EmpresaTenant.objects.filter(slug_subdominio=slug).exists():
        raise ValidationError("Ya existe una empresa con ese subdominio.")


def validar_slug_completo(slug):
    """Ejecuta todas las validaciones requeridas para un subdominio."""
    validar_slug_formato(slug)
    validar_slug_no_reservado(slug)
    validar_slug_unico(slug)


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
