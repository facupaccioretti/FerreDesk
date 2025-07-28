from arca_utils import obtener_ultimo_cbte

print("=== Probando Punto de Venta 1 ===")
resultado_pv1 = obtener_ultimo_cbte(punto_venta=1, tipo_cbte=6)
print("Punto de Venta 1:", resultado_pv1)

print("\n=== Probando Punto de Venta 3 ===")
resultado_pv3 = obtener_ultimo_cbte(punto_venta=3, tipo_cbte=6)
print("Punto de Venta 3:", resultado_pv3)
