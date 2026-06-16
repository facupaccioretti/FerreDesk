#!/bin/bash

set -eu

echo "Iniciando FerreDesk en modo local."
echo "Este script es solo para desarrollo y no debe usarse en produccion."

echo "Esperando a que PostgreSQL local este listo..."
while ! nc -z postgres 5432; do
  echo "PostgreSQL local no esta listo, esperando..."
  sleep 2
done
echo "PostgreSQL local listo."

echo "Preparando directorio local de backups..."
mkdir -p /app/backups
chmod 777 /app/backups

echo "Ejecutando migraciones Django para entorno local..."
python manage.py migrate --noinput

echo "Verificando superusuario local de desarrollo..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@ferredesk.com', 'admin123')
    print('Superusuario local creado: admin/admin123')
else:
    print('Superusuario local ya existe')
"

echo "Recolectando archivos estaticos para entorno local..."
python manage.py collectstatic --noinput

echo "Iniciando servidor local en http://localhost:8000"
exec gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120
