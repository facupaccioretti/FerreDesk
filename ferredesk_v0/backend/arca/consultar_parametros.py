from arca_utils import consultar_parametros_afip

print("=== CONSULTANDO PARÁMETROS VÁLIDOS DE AFIP ===")
print("Esto nos dirá qué campos son requeridos para Factura B")
print("=" * 60)

parametros = consultar_parametros_afip()

if parametros:
    print("\n✅ Parámetros obtenidos correctamente")
    print("Revisa la información anterior para entender:")
    print("- Qué condiciones IVA son válidas")
    print("- Qué tipos de concepto existen")
    print("- Qué tipos de documento son válidos")
else:
    print("\n❌ Error al obtener parámetros") 