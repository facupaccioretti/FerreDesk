#!/bin/bash

set -eu

echo "Iniciando FerreDesk en modo productivo."
echo "El arranque productivo no ejecuta migraciones ni bootstrap local."
echo "Ejecutando collectstatic para publicar assets del build React."

python manage.py collectstatic --noinput

exec gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120
