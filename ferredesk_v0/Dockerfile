# ==========================================
# ETAPA 1: Builder del Frontend (Node)
# ==========================================
FROM node:18-alpine AS frontend_builder

WORKDIR /app/frontend

# Copiar package.json (Asegúrate de que la ruta sea correcta relativa al contexto)
COPY frontend/package*.json ./
RUN npm install

# Copiar el código fuente del frontend y compilar
COPY frontend/ .
RUN npm run build
# Esto genera la carpeta /app/frontend/dist (o build, depende de tu config de Vite/CRA)


# ==========================================
# ETAPA 2: Imagen Final (Python/Django)
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para Postgres
RUN apt-get update && apt-get install -y \
    libpq-dev \
    netcat-traditional \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Instalamos whitenoise explícitamente por si no está en requirements.txt
RUN pip install whitenoise

# Copiar el código del Backend
COPY backend/ .

# --- INTEGRACIÓN: Copiar el build de React desde la Etapa 1 ---
# Asumo que tu build de React crea una carpeta 'dist' o 'build'. 
# Si es Create-React-App es 'build', si es Vite es 'dist'. Ajusta abajo si es necesario:
COPY --from=frontend_builder /app/frontend/build /app/react_frontend

# Crear directorios para estáticos y media
RUN mkdir -p /app/staticfiles /app/media

# Copiar scripts
COPY scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh && sed -i 's/\r$//g' /app/start.sh

# Exponer el único puerto necesario
EXPOSE 8000

CMD ["/app/start.sh"]