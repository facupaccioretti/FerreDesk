import os
import django
import sys

# Configurar entorno Django
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from ferreapps.cuenta_corriente.services.cuenta_corriente_service import obtener_movimientos_cliente
from ferreapps.cuenta_corriente.models import Recibo
from ferreapps.clientes.models import Cliente
from decimal import Decimal

def test_movimientos():
    # Buscar el primer cliente con movimientos
    cliente = Cliente.objects.first()
    if not cliente:
        print("No hay clientes en la DB")
        return

    print(f"Probando movimientos para cliente: {cliente.id} - {cliente.razon}")
    
    movs = obtener_movimientos_cliente(cliente.id, completo=True)
    print(f"Total movimientos encontrados: {len(movs)}")
    
    for m in movs:
        print(f"[{m['fecha']}] {m['comprobante_nombre']} {m['numero_formateado']} - Debe: {m['debe']} Haber: {m['haber']} Pendiente: {m['saldo_pendiente']} CT_ID: {m.get('ct_id')}")

if __name__ == "__main__":
    test_movimientos()
