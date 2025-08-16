FROM python:3.11-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Instalar Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copiar requirements y instalar Python
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# Copiar package.json e instalar Node.js
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

# Copiar código del frontend
COPY frontend/ .
RUN npm run build

# Volver al backend y copiar todo el directorio (ahora está limpio)
WORKDIR /app
COPY backend/ .

# Crear directorios necesarios
RUN mkdir -p data media staticfiles

# Exponer puerto
EXPOSE 8000

# Script de inicio
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"] 