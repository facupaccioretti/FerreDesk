# Comandos para Buildear y Subir Imagen a ferredesk_dev

## 📦 Build y Push de Imagen Docker

### 1. Navegar al directorio del proyecto
```cmd
cd C:\Users\admin\Desktop\FerreDesk\ferredesk_v0
```

### 2. Buildear la imagen con tag dev
```cmd
docker build -t lautajuare/ferredesk_dev:1.0.0 .
```

### 3. (Opcional) Etiquetar también como latest
```cmd
docker tag lautajuare/ferredesk_dev:1.0.0 lautajuare/ferredesk_dev:latest
```

### 4. Login en DockerHub (si no estás logueado)
```cmd
docker login
```
Te pedirá tu usuario y password de DockerHub.

### 5. Subir la imagen a DockerHub
```cmd
docker push lautajuare/ferredesk_dev:1.0.0
```

### 6. (Opcional) Subir también el tag latest
```cmd
docker push lautajuare/ferredesk_dev:latest
```

---

## ✅ Verificación

### Verificar que la imagen se creó localmente:
```cmd
docker images | findstr ferredesk_dev
```

Deberías ver:
```
lautajuare/ferredesk_dev   1.0.0    <IMAGE_ID>   <TIME>   <SIZE>
lautajuare/ferredesk_dev   latest   <IMAGE_ID>   <TIME>   <SIZE>
```

### Verificar en DockerHub:
Visita: https://hub.docker.com/r/lautajuare/ferredesk_dev/tags

---

## 🧪 Probar la Imagen Localmente (antes de subir)

Si quieres probar que la imagen funciona antes de subirla:

```cmd
cd C:\Users\admin\Desktop\FerreDesk\ferredesk_v0

# Crear un docker-compose temporal para testing
docker-compose -f docker-compose-test-dev.yml up -d
```

Donde `docker-compose-test-dev.yml` sería:
```yaml
services:
  postgres:
    image: postgres:15
    container_name: ferredesk_postgres_test
    environment:
      POSTGRES_DB: ferredesk
      POSTGRES_USER: ferredesk_user
      POSTGRES_PASSWORD: test123
      TZ: America/Argentina/Buenos_Aires
      PGTZ: America/Argentina/Buenos_Aires
    volumes:
      - postgres_data_test:/var/lib/postgresql/data
    ports:
      - "5434:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ferredesk_user -d ferredesk"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: lautajuare/ferredesk_dev:1.0.0
    container_name: ferredesk_app_test
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      ENVIRONMENT: production
      DEBUG: False
      SECRET_KEY: test-secret-key-change-in-production
      DATABASE_URL: postgresql://ferredesk_user:test123@postgres:5432/ferredesk
      ALLOWED_HOSTS: *
      TZ: America/Argentina/Buenos_Aires
    volumes:
      - ./media_test:/app/media
    ports:
      - "8001:8000"

volumes:
  postgres_data_test:
```

Luego accede a: http://localhost:8001

---

## 🔄 Comandos Completos (Copy-Paste)

```cmd
cd C:\Users\admin\Desktop\FerreDesk\ferredesk_v0
docker build -t lautajuare/ferredesk_dev:1.0.0 .
docker tag lautajuare/ferredesk_dev:1.0.0 lautajuare/ferredesk_dev:latest
docker login
docker push lautajuare/ferredesk_dev:1.0.0
docker push lautajuare/ferredesk_dev:latest
```

---

## 📝 Notas Importantes

1. **El build puede tardar varios minutos** porque compila el frontend (Node) y el backend (Python)

2. **La imagen resultante será la misma** que usas en producción, solo cambia el repositorio de destino

3. **Tamaño aproximado**: ~500MB-1GB (depende de las dependencias)

4. **Si cambias código**: Repite el proceso de build y push con un nuevo tag (ej: 1.0.1)

5. **Para versiones nuevas**: Cambia el tag `1.0.0` por `1.0.1`, `1.0.2`, etc.
