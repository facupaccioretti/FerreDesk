# ==========================================
# ETAPA 1: Builder del Frontend (Node)
# ==========================================
FROM node:18-alpine AS frontend_builder

WORKDIR /app/frontend

# Copiar dependencias del frontend
COPY frontend/package*.json ./
RUN npm install

# Compilar el artefacto React real
COPY frontend/ .
RUN npm run build


# ==========================================
# ETAPA 2: Imagen Final (Python/Django)
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# Dependencias de compilación y conexión para psycopg/Django. No se instalan
# clientes PostgreSQL: la aplicación no ejecuta dumps ni restores locales.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install whitenoise

# Copiar el cÃ³digo del backend
COPY backend/ .

# Integrar el build de React en la ruta servida por Django
COPY --from=frontend_builder /app/frontend/build /app/react_frontend
RUN test -f /app/react_frontend/index.html
RUN test -d /app/react_frontend/static

# Crear directorios para estÃ¡ticos y media
RUN mkdir -p /app/staticfiles /app/media

# Copiar scripts productivos
COPY scripts/start.prod.sh /app/start.prod.sh
COPY scripts/start.prod-local.sh /app/start.prod-local.sh
COPY scripts/migrate.prod.sh /app/migrate.prod.sh
RUN chmod +x /app/start.prod.sh /app/start.prod-local.sh /app/migrate.prod.sh && sed -i 's/\r$//g' /app/start.prod.sh /app/start.prod-local.sh /app/migrate.prod.sh

# Exponer el Ãºnico puerto necesario
EXPOSE 8000

CMD ["/app/start.prod.sh"]
