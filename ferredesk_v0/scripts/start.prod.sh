#!/bin/bash

set -eu

echo "Iniciando FerreDesk en modo productivo."
echo "El arranque productivo no ejecuta migraciones ni bootstrap local."
echo "Ejecutando collectstatic para publicar assets del build React."

python manage.py collectstatic --noinput

if [ "${ENABLE_EMBEDDED_WORKER:-false}" = "true" ]; then
  echo "Iniciando Worker Centralizado en segundo plano..."
  (
    while true; do
      python manage.py worker_tareas_pendientes
      echo "El worker_tareas_pendientes se cerró, reiniciando en 5 segundos..."
      sleep 5
    done
  ) &
fi

exec gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120
