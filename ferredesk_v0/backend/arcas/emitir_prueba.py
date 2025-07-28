from arca_utils import emitir_comprobante_prueba

resultado = emitir_comprobante_prueba(punto_venta=3, tipo_cbte=6)

if resultado:
    print("\nRESPUESTA CRUDA DE ARCA:")
    print("=" * 50)
    print(resultado)
    print("=" * 50)
else:
    print("\nERROR AL EMITIR COMPROBANTE")
    print("Verificar si el punto de venta está habilitado") 