#!/bin/bash

set -eu

echo "Iniciando FerreDesk en modo prod-local."
echo "Este arranque reproduce Render localmente, pero ejecuta bootstrap controlado para evitar deploys repetidos."

echo "Esperando a que PostgreSQL local este listo..."
while ! nc -z "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}"; do
  echo "PostgreSQL local no esta listo, esperando..."
  sleep 2
done
echo "PostgreSQL local listo."

echo "Ejecutando migrate_schemas para preparar public y tenants."
python manage.py migrate_schemas --noinput

if [ "${PROD_LOCAL_BOOTSTRAP:-true}" = "true" ]; then
  echo "Ejecutando bootstrap local idempotente del tenant demo."
  python manage.py bootstrap_prod_local
else
  echo "Bootstrap local omitido por PROD_LOCAL_BOOTSTRAP=${PROD_LOCAL_BOOTSTRAP:-false}."
fi

echo "Ejecutando collectstatic para publicar assets del build React."
python manage.py collectstatic --noinput

exec gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-2} --timeout ${GUNICORN_TIMEOUT:-120}
