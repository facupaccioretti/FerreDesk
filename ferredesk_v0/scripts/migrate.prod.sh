#!/bin/bash

set -eu

echo "Ejecutando migraciones productivas controladas."
python manage.py migrate_schemas --noinput
