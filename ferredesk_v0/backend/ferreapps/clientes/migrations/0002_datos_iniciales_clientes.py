from decimal import Decimal

from django.db import migrations


def cargar_datos_iniciales_clientes(apps, schema_editor):
	TipoIVA = apps.get_model('clientes', 'TipoIVA')
	Plazo = apps.get_model('clientes', 'Plazo')
	Cliente = apps.get_model('clientes', 'Cliente')
	Vendedor = apps.get_model('clientes', 'Vendedor')

	# TIPOSIVA (IDs fijos)
	TIPOS = [
		{"id": 1, "nombre": "Responsable Inscripto"},
		{"id": 4, "nombre": "Sujeto Exento"},
		{"id": 5, "nombre": "Consumidor Final"},
		{"id": 6, "nombre": "Responsable Monotributo"},
		{"id": 13, "nombre": "Monotributo Social"},
		{"id": 16, "nombre": "Monotributo Trabajador"},
	]
	for t in TIPOS:
		TipoIVA.objects.update_or_create(
			id=t["id"],
			defaults={"nombre": t["nombre"]},
		)

	# PLAZOS (solo el registro CONTADO del doc, PLA_ACTI='T')
	Plazo.objects.update_or_create(
		id=1,
		defaults={
			"nombre": "CONTADO",
			"activo": "T",
			"pla_pla1": 0,
			"pla_pla2": 0,
			"pla_pla3": 0,
			"pla_pla4": 0,
			"pla_pla5": 0,
			"pla_pla6": 0,
			"pla_pla7": 0,
			"pla_pla8": 0,
			"pla_pla9": 0,
			"pla_pla10": 0,
			"pla_pla11": 0,
			"pla_pla12": 0,
			"pla_por1": Decimal('0'),
			"pla_por2": Decimal('0'),
			"pla_por3": Decimal('0'),
			"pla_por4": Decimal('0'),
			"pla_por5": Decimal('0'),
			"pla_por6": Decimal('0'),
			"pla_por7": Decimal('0'),
			"pla_por8": Decimal('0'),
			"pla_por9": Decimal('0'),
			"pla_por10": Decimal('0'),
			"pla_por11": Decimal('0'),
			"pla_por12": Decimal('0'),
		},
	)

	# VENDEDORES (Vendedor Mostrador)
	Vendedor.objects.update_or_create(
		id=1,
		defaults={
			"nombre": "Mostrador",
			"domicilio": "",
			"dni": "0",
			"tel": "",
			"comivta": Decimal('0.00'),
			"liquivta": "N",
			"comicob": Decimal('0.00'),
			"liquicob": "N",
			"localidad": None,
			"activo": "S",
		},
	)

	# CLIENTES (Consumidor Final) según doc
	consumidor_final_tipo = TipoIVA.objects.get(id=5)
	plazo_contado = Plazo.objects.get(id=1)
	vendedor_mostrador = Vendedor.objects.get(id=1)
	Cliente.objects.update_or_create(
		id=1,
		defaults={
			"razon": "Consumidor Final",
			"fantasia": "Consumidor Final",
			"domicilio": "",
			"tel1": "",
			"tel2": "",
			"tel3": "",
			"email": "",
			"ib": "",
			"status": None,
			"contacto": "",
			"comentario": "",
			"lineacred": 0,
			"impsalcta": Decimal('0'),
			"fecsalcta": None,
			"descu1": None,
			"descu2": None,
			"descu3": None,
			"cpostal": "",
			"zona": "",
			"cancela": "",
			"barrio": None,
			"localidad": None,
			"provincia": None,
			"plazo": plazo_contado,
			"iva": consumidor_final_tipo,
			"vendedor": vendedor_mostrador,
			"transporte": None,
			"categoria": None,
			"activo": "A",
			"cuit": "0",
		},
	)


def revertir_datos_iniciales_clientes(apps, schema_editor):
	TipoIVA = apps.get_model('clientes', 'TipoIVA')
	Plazo = apps.get_model('clientes', 'Plazo')
	Cliente = apps.get_model('clientes', 'Cliente')
	Vendedor = apps.get_model('clientes', 'Vendedor')

	Cliente.objects.filter(id=1).delete()
	Vendedor.objects.filter(id=1).delete()
	Plazo.objects.filter(id=1).delete()
	TipoIVA.objects.filter(id__in=[1, 4, 5, 6, 13, 16]).delete()


class Migration(migrations.Migration):

	dependencies = [
		('clientes', '0001_initial'),
	]

	operations = [
		migrations.RunPython(cargar_datos_iniciales_clientes, revertir_datos_iniciales_clientes),
	]


