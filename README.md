
## Descripción general

FerreDesk es una aplicación web para gestionar productos, ventas, clientes, proveedores, cuentas corrientes, compras, reservas e informes. El sistema corre sobre Docker y expone una única aplicación web en `http://localhost:8000` que sirve el frontend con React y el backend con Django integrados.

- Frontend: React + Tailwind CSS (build servido por Django).
- Backend: Django 5 + Django REST Framework.
- Base de datos: PostgreSQL (en Docker). En desarrollo local también se soporta PostgreSQL.
- Integración fiscal: módulo ARCA, WSFEv1 y Constancia Padron.

## Tecnologías

| Capa | Herramientas |
|------|--------------|
| Interfaz | React, Tailwind CSS |
| Backend | Django, Django REST Framework |
| Base de datos | PostgreSQL (Docker), `dj-database-url` |
| Infraestructura | Docker, Docker Compose |

## Estructura del repositorio (actual)

```text
FerreDesk/
├── ferredesk_v0/
│   ├── backend/
│   │   ├── manage.py
│   │   ├── ferredesk_backend/       # Settings, urls, wsgi/asgi
│   │   └── ferreapps/               # Apps: productos, ventas, clientes, etc.
│   │       └── ventas/ARCA/         # Integración ARCA/WSFEv1
│   ├── frontend/                    # App React (código fuente)
│   ├── docker-compose.yml           # Orquestación (Postgres + app)
│   ├── Dockerfile                   # Imagen de la app (Django + build React)
│   ├── start.bat                    # Inicia servicios con Docker Desktop
│   ├── super-install.bat            # Instalación completa en Windows
│   ├── recover-update.bat           # Reconstrucción forzada sin caché
│   ├── update.bat / update2.bat     # Actualizaciones
│   ├── clean.bat                    # Limpieza de artefactos
│   ├── env.example                  # Variables de entorno de ejemplo
│   └── requirements.txt             # Dependencias de Python
├── arca_arg/                        # Librería ARCA (WSFEv1)
└── Documentacion/                   # Documentos técnicos y de negocio
```

## Ejecución rápida (Windows + Docker Desktop)

Requisitos:
- Docker Desktop instalado y corriendo.
- Windows PowerShell.

Pasos típicos:
1. Abrir una consola en `ferredesk_v0`.
2. Ejecutar `start.bat` para iniciar los servicios. El script verifica Docker, levanta los contenedores y valida el acceso.
3. Acceder a `http://localhost:8000`.

Comandos alternativos (manual):
- Iniciar: `docker-compose up -d`
- Ver estado: `docker-compose ps`
- Ver logs: `docker-compose logs -f`
- Detener: `docker-compose down`

## Configuración de base de datos

En Docker, la base utiliza PostgreSQL 15 con variables definidas en `docker-compose.yml`. La aplicación consume `DATABASE_URL` dentro del contenedor.

- Servicio `postgres` (puerto host `5433`, contenedor `5432`).
- Servicio `ferredesk` (aplicación) con `DEBUG=True` por defecto en Docker.

En desarrollo local (sin Docker), la configuración por defecto (`ferredesk_v0/backend/ferredesk_backend/settings.py`) usa PostgreSQL local en `localhost:5432`. Se puede ajustar mediante variables de entorno o editando los parámetros locales.

## Rutas de backend y frontend

- Django sirve el build de React directamente desde el directorio `frontend/build` (detecta si corre en Docker o local para ubicar la ruta).
- Archivos estáticos y el `index.html` del frontend se incluyen en `STATICFILES_DIRS`.

## Integración ARCA / Facturación electrónica

- El módulo `ferreapps/ventas/ARCA` contienen la integración con WSFEv1 y Constancia Padron.
- Existen utilidades específicas para Libro IVA e informes en `ferreapps/ventas`.

## Scripts útiles

- `start.bat`: inicia la aplicación con Docker (intenta arrancar Docker Desktop si no está corriendo, verifica servicios y muestra accesos).
- `recover-update.bat`: detiene servicios, limpia caché de Docker, reconstruye imágenes sin caché y vuelve a iniciar; valida que el frontend se haya construido.
- `update.bat` / `update2.bat`: scripts de actualización.
- `clean.bat`: limpieza de artefactos locales y temporales.

## Solución de problemas

- Verificar que Docker Desktop esté iniciado y saludable.
- Usar `docker-compose logs -f` para inspeccionar errores de inicio.
- Si el frontend no se reconstruye, ejecutar `recover-update.bat` para un build completo sin caché.
- Confirmar que `http://localhost:8000` responde después del arranque; el `start.bat` hace una verificación automática.

