from django.db import migrations


def cargar_comprobantes(apps, schema_editor):
	Comprobante = apps.get_model('ventas', 'Comprobante')

	COMPROBANTES = [
		{"codigo_afip": "001", "nombre": "Factura A", "descripcion": "", "letra": "A", "tipo": "factura", "activo": True},
		{"codigo_afip": "002", "nombre": "Nota de Débito A", "descripcion": "", "letra": "A", "tipo": "nota_debito", "activo": True},
		{"codigo_afip": "003", "nombre": "Nota de Crédito A", "descripcion": "", "letra": "A", "tipo": "nota_credito", "activo": True},
		{"codigo_afip": "006", "nombre": "Factura B", "descripcion": "", "letra": "B", "tipo": "factura", "activo": True},
		{"codigo_afip": "007", "nombre": "Nota de Débito B", "descripcion": "", "letra": "B", "tipo": "nota_debito", "activo": True},
		{"codigo_afip": "008", "nombre": "Nota de Crédito B", "descripcion": "", "letra": "B", "tipo": "nota_credito", "activo": True},
		{"codigo_afip": "011", "nombre": "Factura C", "descripcion": "", "letra": "C", "tipo": "factura", "activo": True},
		{"codigo_afip": "012", "nombre": "Nota de Débito C", "descripcion": "", "letra": "C", "tipo": "nota_debito", "activo": True},
		{"codigo_afip": "013", "nombre": "Nota de Crédito C", "descripcion": "", "letra": "C", "tipo": "nota_credito", "activo": True},
		{"codigo_afip": "004", "nombre": "Recibo A", "descripcion": "", "letra": "A", "tipo": "recibo", "activo": True},
		{"codigo_afip": "009", "nombre": "Recibo B", "descripcion": "", "letra": "B", "tipo": "recibo", "activo": True},
		{"codigo_afip": "015", "nombre": "Recibo C", "descripcion": "", "letra": "C", "tipo": "recibo", "activo": True},
		{"codigo_afip": "9997", "nombre": "Presupuesto", "descripcion": "", "letra": "P", "tipo": "presupuesto", "activo": True},
		{"codigo_afip": "9998", "nombre": "Nota de Credito", "descripcion": "", "letra": "I", "tipo": "nota_credito_interna", "activo": True},
		{"codigo_afip": "9999", "nombre": "Factura I", "descripcion": "", "letra": "I", "tipo": "factura_interna", "activo": True},
	]

	for c in COMPROBANTES:
		Comprobante.objects.update_or_create(
			codigo_afip=c["codigo_afip"],
			defaults={
				"nombre": c["nombre"],
				"descripcion": c["descripcion"],
				"letra": c["letra"],
				"tipo": c["tipo"],
				"activo": c["activo"],
			},
		)


def revertir_comprobantes(apps, schema_editor):
	Comprobante = apps.get_model('ventas', 'Comprobante')
	Comprobante.objects.filter(codigo_afip__in=[
		"001", "002", "003", "006", "007", "008",
		"011", "012", "013", "004", "009", "015",
		"9997", "9998", "9999"
	]).delete()


class Migration(migrations.Migration):

	dependencies = [
		('ventas', '0001_initial'),
	]

	operations = [
		migrations.RunPython(cargar_comprobantes, revertir_comprobantes),
	]


