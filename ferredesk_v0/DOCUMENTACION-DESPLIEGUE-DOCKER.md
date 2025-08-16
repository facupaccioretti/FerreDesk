### FerreDesk – Documentación de Despliegue con Docker

- **Arquitectura**: Django (backend) + React (frontend) servidos por Django
- **Base de datos**: PostgreSQL (contenedor)
- **Ejecución**: Docker Compose orquestando aplicación y base de datos
- **SO objetivo**: Windows 10/11 (funciona también en Linux/Mac con Docker Desktop)

## Estructura de Archivos Relevantes
```
FerreDesk/ferredesk_v0/
├── docker-compose.yml            # Orquestación de servicios (DB + App)
├── Dockerfile                    # Construcción de imagen de la aplicación
├── .dockerignore                 # Exclusiones del contexto Docker
├── env.example                   # Ejemplo de variables de entorno
├── scripts/
│   └── start.sh                  # Script de arranque dentro del contenedor
├── install.bat                   # Instalación automática (Windows)
├── start.bat                     # Inicio rápido (Windows)
├── clean.bat                     # Limpieza completa (Windows)
└── DOCUMENTACION-DESPLIEGUE-DOCKER.md  # Este documento
```

## Archivos y Funcionamiento

### `docker-compose.yml`
-Define y levanta los servicios necesarios.
- **Servicios**:
  - `postgres` (imagen `postgres:15`)
    - Variables: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
    - Puerto expuesto: `5433:5433`
    - Volumen persistente: `postgres_data:/var/lib/postgresql/data`
    - Healthcheck: espera a que la base esté lista antes de iniciar la app
  - `ferredesk` (aplicación Django + build de React)
    - `build: .` (usa `Dockerfile`)
    - Variables clave:
      - `DEBUG=False`
      - `DATABASE_URL=postgresql://ferredesk_user:ferredesk_pass_2024@postgres:5433/ferredesk`
      - `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
    - Volúmenes: `./data`, `./media`, `./staticfiles`
    - Puerto expuesto: `8000:8000`
    - `depends_on` con condición de salud del servicio `postgres`


```bash
docker-compose up --build -d   # Construir e iniciar en segundo plano
docker-compose down            # Detener
```

2) `Dockerfile`
-Construye la imagen de la app (Python + Node + build de React + Django).
- **Pasos principales**:
  - Imagen base: `python:3.11-slim`
  - Instala dependencias del sistema: `gcc`, `libpq-dev`, `curl`, `netcat-traditional`
  - Instala Node.js 18
  - Instala dependencias Python desde `backend/requirements.txt`
  - Instala dependencias del frontend y ejecuta `npm run build`
  - Copia el backend
  - Crea carpetas `data`, `media`, `staticfiles`
  - Copia y usa `scripts/start.sh` como comando de arranque

3) `.dockerignore`
-Excluir del contexto Docker archivos innecesarios para optimizar tiempos y tamaño.
- **Incluye exclusiones típicas**: Git, cachés de Python, `node_modules`, builds, `.env`, archivos de IDE, etc.
- **Nota**: NO se excluir `scripts/start.sh`.  (revisar si falla build)

4) `scripts/start.sh`
-Script que se ejecuta dentro del contenedor de la aplicación al arrancar.
- **Flujo esperado**:
  1. Espera a que PostgreSQL esté disponible en `postgres:5432` (netcat)
  2. Ejecuta migraciones: `python manage.py migrate`
  3. Crea superusuario `admin/admin123` si no existe -----> revisar esto, podemos elegir hacerlo manual cuando instalemos el software por primera vez
  4. Recolecta estáticos: `python manage.py collectstatic --noinput`
  5. Inicia el servidor Django: `python manage.py runserver 0.0.0.0:8000`
---------------------
5) `install.bat` (Windows)
-Instalador automático para usuarios.
- **Flujo esperado**:
  - Verifica que Docker esté instalado y ejecutándose
  - Ejecuta `docker-compose up --build -d`
  - Espera y muestra instrucciones finales (URL y credenciales) --> revisar esto
- **Nota**: doble clic desde Windows o ejecutar en CMD/PowerShell.

6) `start.bat` (Windows)
- **Propósito**: Inicio rápido.
- **Flujo esperado**:
  - Verifica si hay servicios “Up”
  - Si no, `docker-compose up -d`
  - Muestra URL y credenciales

7) `clean.bat` (Windows)
- Limpieza total cuando se necesita reinstalar desde cero.
- **Flujo esperado**:
  - Confirma con el usuario
  - `docker-compose down -v` (elimina volúmenes: se pierden datos)
  - Elimina imágenes (`ferredesk_ferredesk`, `postgres:15` si corresponde)
  - `docker volume prune -f`
  - Borra `./data`, `./media`, `./staticfiles`
---------------
8) `env.example`
- Plantilla de variables de entorno.
- **Incluye**: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`.
- **Uso**: como referencia/documentación; `docker-compose.yml` ya inyecta lo necesario para el entorno Docker.

-----------------------------------------------------------------------------------------------------------------
- Para que Django use PostgreSQL del contenedor (y no SQLite), configura `DATABASES['default']` leyendo `DATABASE_URL` desde el entorno. 
EJEMPLO:
```python
# settings.py
import os
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get(
            'DATABASE_URL',
            'postgresql://ferredesk_user:ferredesk_pass_2024@localhost:5432/ferredesk'
        ),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
```
------------------------------------------------------------------------------------------------------


## TO DO:
-Integrar automáticamente la lectura de `DATABASE_URL` en `settings.py` o que adapte la configuración a otros entornos. 
- Cambiar `SECRET_KEY` 
- Verifica `ALLOWED_HOSTS` si sirves la app en una IP/host diferente.
- Hacer que sea opcional crear superadmin en start.sh



-------------------------------------------------------------------------------------------------
## Requisitos Previos
- Windows 10/11 (64-bit)
- Docker Desktop instalado y ejecutándose
- 4 GB RAM mínimo (8 GB recomendado)
- ~2 GB de espacio libre

## Uso Diario
- Iniciar: doble clic en `start.bat` o `docker-compose up -d`
- Detener: `docker-compose down`
- Logs: `docker-compose logs -f`
- Reiniciar: `docker-compose restart`

## Actualizaciones
- Traer nueva versión y reconstruir:
```bash
docker-compose down
docker-compose up --build -d
```
- Reiniciar solo la app (sin reconstruir):
```bash
docker-compose restart ferredesk
```
----------------------------------------------






## Solución de Problemas
- **Docker no inicia**: abrir Docker Desktop; reiniciar Docker/PC si es necesario.
- **Puerto 8000 ocupado**: editar `docker-compose.yml` y cambiar a `"8001:8000"`.
- **Base de datos corrupta o errores extraños**:
```bash
docker-compose down -v
docker-compose up --build -d
```
- **El contenedor de app no arranca por `start.sh` ausente**: revisa `.dockerignore` y asegúrate de no excluir `scripts/start.sh`.
- **Ver logs detallados**:
```bash
docker-compose logs -f ferredesk
docker-compose logs -f postgres
```