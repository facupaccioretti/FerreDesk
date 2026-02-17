import os
import django
import sys

# Configurar entorno Django
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings')
django.setup()

from ferreapps.cuenta_corriente.models import Recibo

def list_recibos():
    recibos = Recibo.objects.all()
    print(f"Total recibos en DB: {recibos.count()}")
    for r in recibos:
        print(f"ID: {r.rec_id} | Cliente: {r.rec_cliente_id} | Fecha: {r.rec_fecha} | Total: {r.rec_total} | Estado: {r.rec_estado}")

if __name__ == "__main__":
    list_recibos()
