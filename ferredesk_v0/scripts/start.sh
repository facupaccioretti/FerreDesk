#!/bin/bash

echo "🚀 Iniciando FerreDesk..."

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL esté listo..."
while ! nc -z postgres 5432; do
  echo "   PostgreSQL no está listo, esperando..."
  sleep 2
done
echo "✅ PostgreSQL listo!"

# Crear superusuario si no existe
echo "👤 Verificando superusuario..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@ferredesk.com', 'admin123')
    print('✅ Superusuario creado: admin/admin123')
else:
    print('✅ Superusuario ya existe')
"

# Recolectar archivos estáticos
echo "📁 Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

# Iniciar servidor
echo "🌐 Iniciando servidor en http://localhost:8000"
echo "👤 Usuario: admin"
echo "🔑 Contraseña: admin123"
echo ""
python manage.py runserver 0.0.0.0:8000 