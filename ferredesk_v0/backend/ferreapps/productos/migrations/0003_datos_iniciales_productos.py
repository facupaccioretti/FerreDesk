from decimal import Decimal

from django.db import migrations


def cargar_datos_iniciales_productos(apps, schema_editor):
	"""
	Carga datos por defecto requeridos para el funcionamiento inicial:
	- ALICUOTASIVA (6 registros, con IDs fijos)
	- productos_ferreteria (1 registro, ID=1) con los campos disponibles en el modelo actual
	"""
	AlicuotaIVA = apps.get_model('productos', 'AlicuotaIVA')
	Ferreteria = apps.get_model('productos', 'Ferreteria')

	# Constantes: datos exactamente como en Documentacion/datosdefecto.md
	ALICUOTASIVA_FILAS = [
		{"id": 1, "codigo": "1", "deno": "NO GRAVADO", "porce": Decimal('0')},
		{"id": 2, "codigo": "2", "deno": "EXENTO", "porce": Decimal('0')},
		{"id": 3, "codigo": "3", "deno": "0%", "porce": Decimal('0')},
		{"id": 4, "codigo": "4", "deno": "10.5%", "porce": Decimal('10.5')},
		{"id": 5, "codigo": "5", "deno": "21%", "porce": Decimal('21')},
		{"id": 6, "codigo": "6", "deno": "27%", "porce": Decimal('27')},
	]

	for fila in ALICUOTASIVA_FILAS:
		AlicuotaIVA.objects.update_or_create(
			id=fila["id"],
			defaults={
				"codigo": fila["codigo"],
				"deno": fila["deno"],
				"porce": fila["porce"],
			},
		)

	# Ferretería por defecto (incluir únicamente campos que existan en el modelo histórico)
	field_names = {f.name for f in Ferreteria._meta.fields}
	valores_posibles = {
		"nombre": "Ferreteria Default",
		"direccion": "Direccion",
		"telefono": "000",
		"email": "info@ferredesk.local",
		"activa": True,
		"situacion_iva": "RI",
		"punto_venta_arca": "",
		"cuit_cuil": "000",
		"logo_empresa": None,
		"razon_social": "Ferreteria",
		"ingresos_brutos": None,
		"inicio_actividad": None,
		"certificado_arca": None,
		"clave_privada_arca": None,
		"modo_arca": "HOM",
		"arca_habilitado": False,
		"arca_configurado": False,
		"arca_ultima_validacion": None,
		"arca_error_configuracion": None,
	}
	defaults_filtrados = {k: v for k, v in valores_posibles.items() if k in field_names}
	Ferreteria.objects.update_or_create(
		id=1,
		defaults=defaults_filtrados,
	)


def revertir_datos_iniciales_productos(apps, schema_editor):
	AlicuotaIVA = apps.get_model('productos', 'AlicuotaIVA')
	Ferreteria = apps.get_model('productos', 'Ferreteria')

	# Borrar exactamente los IDs sembrados
	AlicuotaIVA.objects.filter(id__in=[1, 2, 3, 4, 5, 6]).delete()
	Ferreteria.objects.filter(id=1).delete()


class Migration(migrations.Migration):

	dependencies = [
		('productos', '0002_vistas_productos'),
	]

	operations = [
		migrations.RunPython(cargar_datos_iniciales_productos, revertir_datos_iniciales_productos),
	]


